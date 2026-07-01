import type { VehicleGalleryData, VehicleImageCategory } from "@/lib/types";
import { VEHICLE_GALLERY_ORDER } from "@/lib/types";
import type { VehicleAiChatChanges } from "@/lib/ai/vehicle-ai-chat-types";

type FlatPhoto = { category: VehicleImageCategory; index: number; url: string };

function flattenGallery(gallery: VehicleGalleryData): FlatPhoto[] {
  const flat: FlatPhoto[] = [];
  for (const category of VEHICLE_GALLERY_ORDER) {
    gallery[category].forEach((url, index) => {
      flat.push({ category, index, url });
    });
  }
  return flat;
}

function ordinalIndex(text: string): number | null {
  const match = text.match(/\b(\d+)(?:st|nd|rd|th)?\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n - 1 : null;
}

function parseCategory(text: string): VehicleImageCategory | null {
  if (/\bexterior\b/i.test(text)) return "exterior";
  if (/\binterior\b/i.test(text)) return "interior";
  if (/\bengine\b/i.test(text)) return "engine";
  if (/\bother\b/i.test(text)) return "other";
  return null;
}

function isPexelsUrl(url: string): boolean {
  return /pexels\.com|images\.pexels\.com/i.test(url);
}

function removeUrl(gallery: VehicleGalleryData, url: string): VehicleGalleryData {
  const next = { ...gallery };
  for (const key of VEHICLE_GALLERY_ORDER) {
    next[key] = next[key].filter((u) => u !== url);
  }
  return next;
}

function moveToFront(
  gallery: VehicleGalleryData,
  category: VehicleImageCategory,
  index: number
): VehicleGalleryData {
  const urls = [...gallery[category]];
  if (index < 0 || index >= urls.length) return gallery;
  const [url] = urls.splice(index, 1);
  urls.unshift(url);
  return { ...gallery, [category]: urls };
}

export type ParsedGalleryCommand = {
  changes: VehicleAiChatChanges;
  reply: string;
};

export function parseGalleryCommand(
  message: string,
  gallery: VehicleGalleryData
): ParsedGalleryCommand | null {
  const text = message.trim();
  if (!text) return null;

  const flat = flattenGallery(gallery);
  if (!flat.length && !/\b(clear|remove|delete)\b/i.test(text)) return null;

  const category = parseCategory(text);

  if (
    /\b(set|make)\b.*\b(first|1st)\b.*\b(hero|cover|main)\b/i.test(text) ||
    /\bhero\b.*\b(first|1st)\b/i.test(text)
  ) {
    const targetCategory = category ?? "exterior";
    const urls = gallery[targetCategory];
    if (!urls.length) {
      return {
        changes: {},
        reply: `No ${targetCategory} photos to set as hero. Upload or paste a photo first.`,
      };
    }
    const idx = ordinalIndex(text);
    const index = idx !== null && idx < urls.length ? idx : 0;
    const nextGallery = moveToFront(gallery, targetCategory, index);
    return {
      changes: { replaceGallery: nextGallery },
      reply:
        index === 0
          ? `Set the first ${targetCategory} photo as the hero (cover) image.`
          : `Moved photo ${index + 1} to the hero position in ${targetCategory}.`,
    };
  }

  if (/\b(last)\b.*\bstock\b/i.test(text) || /\bdelete\b.*\blast\b.*\bstock\b/i.test(text)) {
    const stockPhotos = flat.filter((p) => isPexelsUrl(p.url));
    if (!stockPhotos.length) {
      return { changes: {}, reply: "No stock photos found in the gallery to remove." };
    }
    const last = stockPhotos[stockPhotos.length - 1];
    return {
      changes: { removeFromGallery: [last.url] },
      reply: "Removed the last stock photo from the gallery.",
    };
  }

  if (/\b(remove|delete)\b/i.test(text)) {
    const idx = ordinalIndex(text);
    if (idx !== null) {
      if (category) {
        const url = gallery[category][idx];
        if (!url) {
          return {
            changes: {},
            reply: `No photo at position ${idx + 1} in ${category}.`,
          };
        }
        return {
          changes: { removeFromGallery: [url] },
          reply: `Removed the ${idx + 1}${ordinalSuffix(idx + 1)} ${category} photo.`,
        };
      }

      const photo = flat[idx];
      if (!photo) {
        return { changes: {}, reply: `No photo at position ${idx + 1} in the gallery.` };
      }
      return {
        changes: { removeFromGallery: [photo.url] },
        reply: `Removed photo ${idx + 1} (${photo.category}).`,
      };
    }

    if (/\blast\b/i.test(text)) {
      const photo = flat[flat.length - 1];
      if (!photo) return { changes: {}, reply: "The gallery is empty." };
      return {
        changes: { removeFromGallery: [photo.url] },
        reply: `Removed the last photo (${photo.category}).`,
      };
    }

    if (/\bfirst\b/i.test(text)) {
      const photo = flat[0];
      if (!photo) return { changes: {}, reply: "The gallery is empty." };
      return {
        changes: { removeFromGallery: [photo.url] },
        reply: `Removed the first photo (${photo.category}).`,
      };
    }
  }

  if (/\bclear\b.*\b(exterior|interior|engine|other)\b/i.test(text) && category) {
    const next = { ...gallery, [category]: [] as string[] };
    return {
      changes: { replaceGallery: next },
      reply: `Cleared all ${category} photos.`,
    };
  }

  return null;
}

function ordinalSuffix(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "st";
  if (mod10 === 2 && mod100 !== 12) return "nd";
  if (mod10 === 3 && mod100 !== 13) return "rd";
  return "th";
}

export function applyGalleryReplacements(
  gallery: VehicleGalleryData,
  changes: Pick<VehicleAiChatChanges, "removeFromGallery" | "replaceGallery">
): VehicleGalleryData {
  let next = changes.replaceGallery ? { ...changes.replaceGallery } : { ...gallery };

  if (changes.removeFromGallery?.length) {
    for (const url of changes.removeFromGallery) {
      next = removeUrl(next, url);
    }
  }

  return next;
}

export function replaceGalleryUrl(
  gallery: VehicleGalleryData,
  sourceUrl: string,
  newUrl: string
): VehicleGalleryData {
  const next = { ...gallery };
  for (const key of VEHICLE_GALLERY_ORDER) {
    next[key] = next[key].map((u) => (u === sourceUrl ? newUrl : u));
  }
  return next;
}

export function pickDefaultEditImageUrl(
  gallery: VehicleGalleryData,
  preferredUrl?: string | null
): string | null {
  if (preferredUrl && flattenGallery(gallery).some((p) => p.url === preferredUrl)) {
    return preferredUrl;
  }
  if (gallery.exterior.length) return gallery.exterior[0];
  const flat = flattenGallery(gallery);
  return flat[0]?.url ?? null;
}
