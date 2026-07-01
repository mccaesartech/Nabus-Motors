export const IMAGE_ADJUST_PRESETS = [
  "warm",
  "cool",
  "brighten",
  "darken",
  "contrast",
  "vibrant",
  "muted",
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
};

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

  if (parseColorAdjustPreset(text)) return true;

  return (
    /\b(colou?r|tone|filter|brightness|saturation)\b/i.test(text) &&
    /\b(make|adjust|change|edit|fix|improve)\b/i.test(text)
  );
}

export function colorAdjustReply(preset: ImageAdjustPreset): string {
  return `Applied “${IMAGE_ADJUST_LABELS[preset]}” filter to your photo. This adjusts brightness, contrast, and saturation — not AI image generation.`;
}
