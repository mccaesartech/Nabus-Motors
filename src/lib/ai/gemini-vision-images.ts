import "server-only";

import type { GeminiContentPart } from "@/lib/ai/gemini";
import { resolveInlineImageMime } from "@/lib/ai/image-mime-sniff";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type GeminiInlineImage = {
  url: string;
  data: string;
  mimeType: string;
};

export async function fetchImageAsInlineData(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const headerMime = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;
    const mime = resolveInlineImageMime(headerMime || null, buffer, url);
    if (!mime) return null;
    return {
      data: buffer.toString("base64"),
      mimeType: mime,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Download listing photo URLs into Gemini inlineData parts (skips failures). */
export async function fetchUrlsAsGeminiInlineImages(
  urls: string[],
  options?: { concurrency?: number }
): Promise<GeminiInlineImage[]> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const results: GeminiInlineImage[] = [];

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const fetched = await Promise.all(
      batch.map(async (url) => {
        const inline = await fetchImageAsInlineData(url);
        return inline ? { url, ...inline } : null;
      })
    );
    for (const row of fetched) {
      if (row) results.push(row);
    }
  }

  return results;
}

export function geminiPartsForInlineImages(
  images: GeminiInlineImage[]
): GeminiContentPart[] {
  return images.flatMap((img) => [
    { text: `\nPhoto URL: ${img.url}` },
    { inlineData: { data: img.data, mimeType: img.mimeType } },
  ]);
}
