export const IMAGE_ADJUST_PRESETS = [
  "warm",
  "cool",
  "brighten",
  "darken",
  "contrast",
  "vibrant",
  "muted",
  "enhance",
] as const;

export type ImageAdjustPreset = (typeof IMAGE_ADJUST_PRESETS)[number];

export const IMAGE_ADJUST_LABELS: Record<ImageAdjustPreset, string> = {
  warm: "Warm up colors",
  cool: "Cool down colors",
  brighten: "Brighten",
  darken: "Darken",
  contrast: "Increase contrast",
  vibrant: "More vibrant",
  muted: "Mute colors",
  enhance: "Enhance photos (4K)",
};

/** Exact quick-action chip / short-circuit label for 4K enhance. */
export const ENHANCE_PHOTOS_4K_ACTION = IMAGE_ADJUST_LABELS.enhance;

const PRESET_PATTERNS: Array<{ preset: ImageAdjustPreset; patterns: RegExp[] }> = [
  {
    preset: "warm",
    patterns: [
      /\bwarm(?:er| up)?\b/i,
      /\bwarmer\s*colou?rs?\b/i,
      /\bgolden\s*tone\b/i,
      /\bsunset\s*tone\b/i,
    ],
  },
  {
    preset: "cool",
    patterns: [/\bcool(?:er| down)?\b/i, /\bcooler\s*colou?rs?\b/i, /\bblue\s*tone\b/i],
  },
  {
    preset: "brighten",
    patterns: [/\bbrighten\b/i, /\bbrighter\b/i, /\blighter\b/i, /\bincrease\s*brightness\b/i],
  },
  {
    preset: "darken",
    patterns: [/\bdarken\b/i, /\bdarker\b/i, /\breduce\s*brightness\b/i],
  },
  {
    preset: "contrast",
    patterns: [
      /\bcontrast\b/i,
      /\bmore\s*contrast\b/i,
      /\bincrease\s*contrast\b/i,
      /\bsharper\b/i,
    ],
  },
  {
    preset: "vibrant",
    patterns: [
      /\bvibrant\b/i,
      /\bmore\s*vibrant\b/i,
      /\bpop\b/i,
      /\bsaturat/i,
      /\bmore\s*colou?r\b/i,
    ],
  },
  {
    preset: "muted",
    patterns: [/\bmuted\b/i, /\bdesaturat/i, /\bless\s*vibrant\b/i],
  },
];

export function isImageAdjustPreset(value: string): value is ImageAdjustPreset {
  return (IMAGE_ADJUST_PRESETS as readonly string[]).includes(value);
}

export function parseColorAdjustPreset(message: string): ImageAdjustPreset | null {
  const text = message.trim();
  if (!text) return null;

  // Quality enhance / 4K is not a color filter preset.
  if (isImageEnhanceRequest(text)) return null;

  for (const { preset, patterns } of PRESET_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return preset;
  }

  if (/adjust\s*colou?rs?/i.test(text) || /change\s*(the\s*)?colou?rs?/i.test(text)) {
    return "vibrant";
  }

  return null;
}

export function isColorAdjustRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  // Quality / 4K enhance is a separate pipeline — do not treat as color filter.
  if (isImageEnhanceRequest(text)) return false;

  if (parseColorAdjustPreset(text)) return true;

  return (
    /\b(colou?r|tone|filter|brightness|saturation)\b/i.test(text) &&
    /\b(make|adjust|change|edit|fix|improve)\b/i.test(text)
  );
}

/**
 * Detect “upgrade / enhance / 4K / upscale / higher quality” photo requests.
 * Must win over Gemini listing-fill chat so we never refuse with “I cannot enhance”.
 */
export function isImageEnhanceRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  if (text === ENHANCE_PHOTOS_4K_ACTION) return true;

  // Description / copy rewrites are not image enhance.
  if (
    /\b(description|listing\s+copy|title|warranty|inspection)\b/i.test(text) &&
    !/\b(photo|image|picture|gallery|4k|upscale|resolution)\b/i.test(text)
  ) {
    return false;
  }

  if (/\b(4k|uhd|ultra[\s-]*hd)\b/i.test(text)) return true;
  if (/\b(upscale|up[\s-]*scale)\b/i.test(text)) return true;
  if (/\b(higher|better|improve[d]?|upgrade[d]?)\s+(image\s+|photo\s+|picture\s+)?(quality|resolution|clarity)\b/i.test(text)) {
    return true;
  }
  if (/\b(enhance|enhancement)\b/i.test(text) && /\b(photo|image|picture|gallery|quality|resolution|clarity)\b/i.test(text)) {
    return true;
  }
  if (/\b(enhance|enhancement)\b/i.test(text) && !/\b(description|listing|title|warranty|inspection|field)\b/i.test(text)) {
    return true;
  }
  if (/\b(sharpen|make\s+sharper)\b/i.test(text) && /\b(photo|image|picture|gallery)\b/i.test(text)) {
    return true;
  }
  if (
    /\b(make|upgrade|increase|boost)\b/i.test(text) &&
    /\b(quality|resolution|clarity)\b/i.test(text) &&
    /\b(photo|image|picture|gallery|this)\b/i.test(text)
  ) {
    return true;
  }

  return false;
}

export function colorAdjustReply(preset: ImageAdjustPreset): string {
  if (preset === "enhance") {
    return enhanceImageReply();
  }
  return `Ready to apply “${IMAGE_ADJUST_LABELS[preset]}” to your photo. Review the before/after preview, then Approve to update the gallery — nothing changes until you confirm. This adjusts brightness, contrast, and saturation — not AI image generation.`;
}

export function enhanceImageReply(): string {
  return `Ready to enhance this photo toward ~4K listing clarity (longest side up to 3840px) with sharpening and contrast. Review the before/after preview, then Approve to update the gallery — nothing changes until you confirm. This is Sharp resize + clarity enhance for web/listing sharpness — not generative AI inventing missing detail.`;
}
