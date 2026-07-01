export type VideoAspect = "16:9" | "4:3" | "9:16" | "3:4" | "1:1" | "21:9";
export type VideoSize = "sm" | "md" | "lg" | "full";
export type VideoObjectFit = "cover" | "contain";

export type SiteVideoDisplaySettings = {
  videoAspect: VideoAspect;
  videoSize: VideoSize;
  videoObjectFit: VideoObjectFit;
};

export const DEFAULT_VIDEO_DISPLAY: SiteVideoDisplaySettings = {
  videoAspect: "16:9",
  videoSize: "lg",
  videoObjectFit: "cover",
};

export const VIDEO_ASPECT_OPTIONS: { value: VideoAspect; label: string }[] = [
  { value: "16:9", label: "Landscape 16:9" },
  { value: "4:3", label: "Landscape 4:3" },
  { value: "9:16", label: "Portrait 9:16" },
  { value: "3:4", label: "Portrait 3:4" },
  { value: "1:1", label: "Square 1:1" },
  { value: "21:9", label: "Full width (21:9)" },
];

export const VIDEO_SIZE_OPTIONS: { value: VideoSize; label: string; short: string }[] = [
  { value: "sm", label: "Small (240px)", short: "S" },
  { value: "md", label: "Medium (360px)", short: "M" },
  { value: "lg", label: "Large (480px)", short: "L" },
  { value: "full", label: "Full width", short: "Full" },
];

export const VIDEO_OBJECT_FIT_OPTIONS: { value: VideoObjectFit; label: string }[] = [
  { value: "cover", label: "Cover (fill frame)" },
  { value: "contain", label: "Contain (letterbox)" },
];

const ASPECT_CLASS: Record<VideoAspect, string> = {
  "16:9": "aspect-video",
  "4:3": "aspect-[4/3]",
  "9:16": "aspect-[9/16]",
  "3:4": "aspect-[3/4]",
  "1:1": "aspect-square",
  "21:9": "aspect-[21/9]",
};

const SIZE_MAX_WIDTH: Record<VideoSize, string> = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  full: "max-w-full",
};

const SIZE_MAX_HEIGHT: Record<VideoSize, string> = {
  sm: "max-h-60",
  md: "max-h-[360px]",
  lg: "max-h-[480px]",
  full: "max-h-[640px]",
};

export function resolveVideoDisplay(
  settings?: Partial<SiteVideoDisplaySettings>
): SiteVideoDisplaySettings {
  return {
    videoAspect: settings?.videoAspect ?? DEFAULT_VIDEO_DISPLAY.videoAspect,
    videoSize: settings?.videoSize ?? DEFAULT_VIDEO_DISPLAY.videoSize,
    videoObjectFit: settings?.videoObjectFit ?? DEFAULT_VIDEO_DISPLAY.videoObjectFit,
  };
}

export function getVideoFrameClassName(
  settings?: Partial<SiteVideoDisplaySettings>,
  extra?: string
): string {
  const resolved = resolveVideoDisplay(settings);
  return [
    "relative w-full overflow-hidden",
    ASPECT_CLASS[resolved.videoAspect],
    SIZE_MAX_WIDTH[resolved.videoSize],
    SIZE_MAX_HEIGHT[resolved.videoSize],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function getVideoMediaClassName(
  settings?: Partial<SiteVideoDisplaySettings>,
  extra?: string
): string {
  const resolved = resolveVideoDisplay(settings);
  const fitClass =
    resolved.videoObjectFit === "contain" ? "object-contain" : "object-cover";
  return ["h-full w-full", fitClass, extra].filter(Boolean).join(" ");
}

export function getVideoWrapperClassName(
  settings?: Partial<SiteVideoDisplaySettings>,
  centered = true
): string {
  const resolved = resolveVideoDisplay(settings);
  return [
    centered ? "mx-auto" : "",
    SIZE_MAX_WIDTH[resolved.videoSize],
    resolved.videoSize === "full" ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
