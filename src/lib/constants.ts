export const COMPANY_NAME = "True Goshen Company Limited";
export const SITE_NAME = "True Goshen Auto";
export const SITE_PHONE_LOCAL = "024 487 6784";
export const SITE_PHONE_INTL = "+233244876784";
export const SITE_PHONE_DISPLAY = "+233 24 487 6784";
export const WHATSAPP_NUMBER = "233244876784";
export const SITE_EMAIL = "info@truegoshenauto.com";
export const SITE_ADDRESS_LINE1 = "Ring Road East, Accra";
export const SITE_ADDRESS_LINE2 = "Greater Accra, Ghana";
export const SITE_ADDRESS_FULL =
  "Ring Road East, Accra, Greater Accra, Ghana";
export const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Ring+Road+East,+Accra,+Greater+Accra,+Ghana";

/** Self-hosted stock hero background when CMS video mode is on but no upload/embed is set. */
export const DEFAULT_HERO_BACKGROUND_VIDEO_URL = "/videos/hero-background.mp4";

/** Poster shown before video loads and when all video sources fail. */
export const DEFAULT_HERO_POSTER_URL = "/images/hero-pinterest-poster.jpg";

/** Default hero footage — Pinterest pin hrDTf525I (luxury car cinematic). */
export const DEFAULT_HERO_VIDEO_SOURCE =
  "Pinterest — Luxury car cinematic (pin.it/hrDTf525I)";

/** Last-resort YouTube embed when the stock MP4 fails to load. */
export const DEFAULT_HERO_BACKGROUND_EMBED_URL =
  "https://www.youtube.com/watch?v=pu-tvoWj1sE";

/** Corporate homepage hero — logistics, vehicles, and freight montage. */
export const CORPORATE_HERO_VIDEO_URL = "/videos/corporate-hero.mp4";

/** Lower-bitrate mobile variant (generate with scripts/optimize-videos.ps1). */
export const CORPORATE_HERO_VIDEO_MOBILE_URL = "/videos/corporate-hero-mobile.mp4";

/** Poster for corporate hero video (first frame of montage). */
export const CORPORATE_HERO_POSTER_URL = "/images/corporate-hero-poster.jpg";

/** Source attribution for corporate hero montage (Pexels, royalty-free). */
export const CORPORATE_HERO_VIDEO_SOURCE =
  "Pexels — logistics hub aerial (6585382), vehicles (2103099), port shipping (3045163)";

export function whatsappUrl(message?: string, number = WHATSAPP_NUMBER): string {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
