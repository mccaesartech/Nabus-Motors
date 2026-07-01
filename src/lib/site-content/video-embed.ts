export type SiteVideoEmbedSettings = {
  /** Use modestbranding, nocookie domain, hide annotations */
  embedMinimalBranding: boolean;
  /** Hide play bar, fullscreen, and keyboard shortcuts */
  embedHideControls: boolean;
  /** Suppress related videos at end (YouTube rel=0) */
  embedHideRelated: boolean;
};

export const DEFAULT_VIDEO_EMBED: SiteVideoEmbedSettings = {
  embedMinimalBranding: true,
  embedHideControls: true,
  embedHideRelated: true,
};

export type EmbedBuildContext = Partial<SiteVideoEmbedSettings> & {
  /** Hero/background mode: autoplay muted loop */
  background?: boolean;
};

export function resolveVideoEmbedSettings(
  settings?: Partial<SiteVideoEmbedSettings>
): SiteVideoEmbedSettings {
  return {
    embedMinimalBranding:
      settings?.embedMinimalBranding ?? DEFAULT_VIDEO_EMBED.embedMinimalBranding,
    embedHideControls: settings?.embedHideControls ?? DEFAULT_VIDEO_EMBED.embedHideControls,
    embedHideRelated: settings?.embedHideRelated ?? DEFAULT_VIDEO_EMBED.embedHideRelated,
  };
}

export function buildYouTubeEmbedUrl(videoId: string, context: EmbedBuildContext = {}): string {
  const settings = resolveVideoEmbedSettings(context);
  const background = context.background ?? false;

  const host = settings.embedMinimalBranding
    ? "https://www.youtube-nocookie.com"
    : "https://www.youtube.com";

  const params = new URLSearchParams();

  if (background) {
    params.set("autoplay", "1");
    params.set("mute", "1");
    params.set("loop", "1");
    params.set("playlist", videoId);
    params.set("playsinline", "1");
  }

  params.set("controls", settings.embedHideControls ? "0" : "1");
  params.set("rel", settings.embedHideRelated ? "0" : "1");

  if (settings.embedMinimalBranding) {
    params.set("modestbranding", "1");
    params.set("iv_load_policy", "3");
  }

  if (settings.embedHideControls) {
    params.set("disablekb", "1");
    params.set("fs", "0");
  }

  return `${host}/embed/${videoId}?${params.toString()}`;
}

export function buildVimeoEmbedUrl(videoId: string, context: EmbedBuildContext = {}): string {
  const settings = resolveVideoEmbedSettings(context);
  const background = context.background ?? false;

  const params = new URLSearchParams();

  if (background) {
    params.set("autoplay", "1");
    params.set("muted", "1");
    params.set("loop", "1");
    params.set("background", "1");
  }

  if (settings.embedMinimalBranding) {
    params.set("title", "0");
    params.set("byline", "0");
    params.set("portrait", "0");
  }

  if (settings.embedHideControls && !background) {
    params.set("controls", "0");
  }

  return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
}
