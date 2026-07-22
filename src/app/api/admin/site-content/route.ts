import { NextRequest, NextResponse } from "next/server";
import { friendlyAdminDbError } from "@/lib/admin/api-errors";
import { requirePermission } from "@/lib/admin/auth";
import { revalidateSiteContent } from "@/lib/admin/revalidate";
import { isValidImageUrl } from "@/lib/data/vehicle-images";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  DEFAULT_SITE_CONTENT,
  SITE_CONTENT_SECTIONS,
  type SiteContentSection,
  dbKeyToSection,
  mergeSiteContent,
  sectionToDbKey,
} from "@/lib/site-content/defaults";

function isValidSection(section: string): section is SiteContentSection {
  return (SITE_CONTENT_SECTIONS as readonly string[]).includes(section);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Ensure category image URLs are absolute and stored on the `image` field before upsert. */
function normalizeSectionForSave(
  section: SiteContentSection,
  content: Record<string, unknown>
): Record<string, unknown> {
  const cardsKey =
    section === "browseByCategory"
      ? "categories"
      : section === "corporateServices" ||
          section === "sparePartsLanding" ||
          section === "freightLanding" ||
          section === "shippingConsultation" ||
          section === "corporateServicesPage" ||
          section === "corporateDivisions" ||
          section === "freightTracking" ||
          section === "startYourJourney"
        ? "cards"
        : null;

  if (cardsKey) {
    const items = content[cardsKey];
    if (!Array.isArray(items)) return content;

    const normalizedCards = {
      ...content,
      [cardsKey]: items.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return item;
        }

        const row = item as Record<string, unknown>;
        const rawImage =
          asTrimmedString(row.image) ||
          asTrimmedString(row.imageUrl) ||
          asTrimmedString(row.customImage);
        const normalized = normalizeMediaUrl(rawImage);
        const image = isValidImageUrl(normalized)
          ? normalized
          : isValidImageUrl(rawImage)
            ? rawImage
            : normalized;

        return { ...row, image };
      }),
    };

    if (section === "startYourJourney" && isPlainObject(content.advisor)) {
      const advisor = content.advisor as Record<string, unknown>;
      const rawImage =
        asTrimmedString(advisor.image) || asTrimmedString(advisor.imageUrl);
      const normalized = normalizeMediaUrl(rawImage);
      const image = isValidImageUrl(normalized)
        ? normalized
        : isValidImageUrl(rawImage)
          ? rawImage
          : normalized;
      return {
        ...normalizedCards,
        advisor: { ...advisor, image },
      };
    }

    return normalizedCards;
  }

  return content;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const auth = await requirePermission("site_content");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      content: DEFAULT_SITE_CONTENT,
    });
  }

  const { data, error } = await supabase.from("site_content").select("section, content");

  if (error) {
    console.error("site_content admin fetch failed:", error.message);
    const friendly = friendlyAdminDbError(error.message);
    const tableMissing = friendly !== error.message;
    return NextResponse.json({
      ok: !tableMissing,
      configured: true,
      message: tableMissing ? friendly : undefined,
      content: DEFAULT_SITE_CONTENT,
    });
  }

  const patch: Partial<Record<SiteContentSection, unknown>> = {};
  for (const row of data ?? []) {
    const section = dbKeyToSection(row.section);
    if (section && row.content) {
      patch[section] = row.content;
    }
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    content: mergeSiteContent(patch),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("site_content");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = (await req.json()) as {
    section?: SiteContentSection;
    content?: Record<string, unknown>;
    sections?: Partial<Record<SiteContentSection, Record<string, unknown>>>;
  };

  const updates: Partial<Record<SiteContentSection, Record<string, unknown>>> = {};

  if (body.section && isValidSection(body.section) && body.content) {
    updates[body.section] = normalizeSectionForSave(body.section, body.content);
  } else if (body.sections) {
    for (const [key, value] of Object.entries(body.sections)) {
      if (isValidSection(key) && value) {
        updates[key] = normalizeSectionForSave(key, value);
      }
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: false, message: "No valid sections to update" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    const merged = mergeSiteContent(updates);
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Saved locally only — configure Supabase to persist.",
      content: merged,
    });
  }

  const rows = Object.entries(updates).map(([section, content]) => {
    const merged = mergeSiteContent({ [section as SiteContentSection]: content });
    return {
      section: sectionToDbKey(section as SiteContentSection),
      content: merged[section as SiteContentSection],
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "section" });

  if (error) {
    console.error("site_content upsert failed:", error.message);
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(error.message) },
      { status: 500 }
    );
  }

  revalidateSiteContent();

  const fullContent = mergeSiteContent(
    Object.fromEntries(
      rows.map((row) => {
        const section = SITE_CONTENT_SECTIONS.find(
          (s) => sectionToDbKey(s) === row.section
        ) as SiteContentSection;
        return [section, row.content];
      })
    ) as Partial<Record<SiteContentSection, unknown>>
  );

  return NextResponse.json({ ok: true, configured: true, content: fullContent });
}
