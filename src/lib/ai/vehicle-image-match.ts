import "server-only";

import { generateGeminiText, getGeminiApiKey } from "@/lib/ai/gemini";
import { fetchImageAsInlineData } from "@/lib/ai/gemini-vision-images";
import type {
  VehicleImageMatchContext,
  VehicleImageMatchIssue,
  VehicleImageMatchResult,
} from "@/lib/ai/vehicle-image-match-types";

export type {
  VehicleImageMatchContext,
  VehicleImageMatchIssue,
  VehicleImageMatchResult,
  VehicleImageMatchStatus,
} from "@/lib/ai/vehicle-image-match-types";

const MAX_IMAGES = 3;

function isStockPlaceholderUrl(url: string): boolean {
  return /pexels\.com|images\.pexels\.com/i.test(url);
}

function parseMatchJson(raw: string): {
  issues: VehicleImageMatchIssue[];
  summary: string;
} {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(jsonText) as {
      summary?: string;
      images?: Array<{ url?: string; status?: string; reason?: string }>;
    };
    const issues: VehicleImageMatchIssue[] = (parsed.images ?? [])
      .map((row) => {
        const status = row.status;
        if (
          status !== "match" &&
          status !== "mismatch" &&
          status !== "no_vehicle" &&
          status !== "uncertain"
        ) {
          return null;
        }
        if (!row.url?.trim()) return null;
        return {
          url: row.url.trim(),
          status,
          reason: (row.reason ?? "").trim() || "No reason provided.",
        };
      })
      .filter((row): row is VehicleImageMatchIssue => Boolean(row));

    return {
      issues,
      summary: (parsed.summary ?? "").trim() || "Image review completed.",
    };
  } catch {
    return {
      issues: [],
      summary: "Could not parse image review response.",
    };
  }
}

function blockingIssues(issues: VehicleImageMatchIssue[]): VehicleImageMatchIssue[] {
  return issues.filter((issue) => issue.status === "mismatch" || issue.status === "no_vehicle");
}

/**
 * Heuristic + optional Gemini vision check that listing photos show a real vehicle
 * matching the declared make/model/year/color closely enough to publish.
 */
export async function verifyVehicleImagesMatch(
  imageUrls: string[],
  vehicle: VehicleImageMatchContext
): Promise<VehicleImageMatchResult> {
  const urls = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))].slice(0, MAX_IMAGES);

  if (urls.length === 0) {
    return {
      ok: true,
      configured: Boolean(getGeminiApiKey()),
      blocked: true,
      overallMatch: false,
      manualReviewRequired: false,
      summary: "Add at least one vehicle photo before submitting.",
      issues: [
        {
          url: "",
          status: "no_vehicle",
          reason: "No photos were provided for this listing.",
        },
      ],
    };
  }

  const stockIssues: VehicleImageMatchIssue[] = urls
    .filter(isStockPlaceholderUrl)
    .map((url) => ({
      url,
      status: "mismatch" as const,
      reason:
        "This looks like a stock placeholder photo. Replace it with photos of the actual vehicle before publishing.",
    }));

  if (stockIssues.length > 0 && stockIssues.length === urls.length) {
    return {
      ok: true,
      configured: Boolean(getGeminiApiKey()),
      blocked: true,
      overallMatch: false,
      manualReviewRequired: false,
      summary: "Stock placeholder photos cannot be published as the listing photos.",
      issues: stockIssues,
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const issues = [...stockIssues];
    return {
      ok: true,
      configured: false,
      blocked: issues.length > 0,
      overallMatch: issues.length === 0,
      manualReviewRequired: true,
      summary:
        issues.length > 0
          ? "Remove stock placeholder photos, then manually confirm the remaining photos match this vehicle."
          : "AI image verification is unavailable. Manually confirm every photo matches this vehicle before publishing.",
      issues,
    };
  }

  const inlineParts: Array<{ url: string; data: string; mimeType: string }> = [];
  for (const url of urls) {
    if (isStockPlaceholderUrl(url)) continue;
    const inline = await fetchImageAsInlineData(url);
    if (inline) inlineParts.push({ url, ...inline });
  }

  if (inlineParts.length === 0) {
    const issues =
      stockIssues.length > 0
        ? stockIssues
        : urls.map((url) => ({
            url,
            status: "uncertain" as const,
            reason: "Could not download this image for automated review.",
          }));
    return {
      ok: true,
      configured: true,
      blocked: stockIssues.length > 0,
      overallMatch: false,
      manualReviewRequired: stockIssues.length === 0,
      summary:
        stockIssues.length > 0
          ? "Stock placeholder photos must be replaced with photos of the actual vehicle."
          : "Could not download listing photos for automated review. Manually confirm they match this vehicle.",
      issues,
    };
  }

  const label = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const prompt = `You are verifying dealership inventory photos for True Goshen Auto.
Compare each photo to the declared vehicle listing and return ONLY valid JSON (no markdown):
{
  "summary": "one short sentence",
  "images": [
    { "url": "exact url provided", "status": "match|mismatch|no_vehicle|uncertain", "reason": "short reason" }
  ]
}
Rules:
- status "no_vehicle" if the image does not clearly show a car/SUV/truck/van (or only shows an unrelated object/person/empty scene).
- status "mismatch" if it shows a vehicle that clearly does not match the declared make/model/generation, body style, or exterior color when those are provided.
- status "match" if it plausibly shows the declared vehicle (or a matching exterior/interior/engine detail photo).
- status "uncertain" only when the photo is too unclear to judge.
- Interior, engine-bay, wheel, and VIN-plate photos can be "match" when consistent with a vehicle listing.
- Do not invent URLs. Use the exact URLs provided below.
Declared vehicle: ${label || "unknown"}
Color: ${vehicle.color?.trim() || "unspecified"}
Body type: ${vehicle.body_type?.trim() || "unspecified"}
Image URLs in order:
${inlineParts.map((p, i) => `${i + 1}. ${p.url}`).join("\n")}`;

  const parts = [
    { text: prompt },
    ...inlineParts.flatMap((p) => [
      { text: `\nPhoto URL: ${p.url}` },
      { inlineData: { data: p.data, mimeType: p.mimeType } },
    ]),
  ];

  const raw = await generateGeminiText(parts, { maxRetries: 1 });
  const parsed = parseMatchJson(raw);

  const byUrl = new Map(parsed.issues.map((issue) => [issue.url, issue]));
  const merged: VehicleImageMatchIssue[] = [];

  for (const stock of stockIssues) {
    merged.push(stock);
  }

  for (const part of inlineParts) {
    const fromAi = byUrl.get(part.url);
    merged.push(
      fromAi ?? {
        url: part.url,
        status: "uncertain",
        reason: "Automated review did not return a result for this photo.",
      }
    );
  }

  for (const url of urls) {
    if (merged.some((issue) => issue.url === url)) continue;
    merged.push({
      url,
      status: "uncertain",
      reason: "This photo was not included in automated review.",
    });
  }

  const blockedList = blockingIssues(merged);
  const hasUncertain = merged.some((issue) => issue.status === "uncertain");

  return {
    ok: true,
    configured: true,
    blocked: blockedList.length > 0,
    overallMatch: blockedList.length === 0 && !hasUncertain,
    manualReviewRequired: blockedList.length === 0 && hasUncertain,
    summary:
      parsed.summary ||
      (blockedList.length > 0
        ? "One or more photos do not match this vehicle listing."
        : hasUncertain
          ? "Some photos need a manual check before publishing."
          : "Photos appear to match this vehicle."),
    issues: merged,
  };
}
