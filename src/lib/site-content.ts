import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

/** Cache tag for on-demand invalidation after CMS saves. */
export const SITE_CONTENT_CACHE_TAG = "site-content";

/** Time-based revalidation for CMS content (seconds). */
export const SITE_CONTENT_REVALIDATE_SECONDS = 120;
import {
  DEFAULT_HERO_BACKGROUND_VIDEO_URL,
  DEFAULT_HERO_POSTER_URL,
} from "@/lib/constants";
import { vehicleImages } from "@/lib/data/vehicles";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { resolveVideo, type ResolvedVideo } from "@/lib/site-content/video";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import {
  DEFAULT_SITE_CONTENT,
  type AboutSiteContent,
  type HomepageSiteContent,
  type SiteContent,
  type SiteContentSection,
  dbKeyToSection,
  mergeSiteContent,
} from "@/lib/site-content/defaults";

export {
  normalizeMediaUrl,
  resolveCategoryImage,
  resolveTestimonialImage,
} from "@/lib/site-content/media-url";

export type {
  AboutSiteContent,
  BrowseByCategoryCard,
  BrowseByCategorySiteContent,
  ContactSiteContent,
  FooterSiteContent,
  GlobalSiteContent,
  HeaderSiteContent,
  HomepageSiteContent,
  PageHeroSiteContent,
  SiteContent,
  SiteContentCard,
  SiteContentNavLink,
  SiteContentSection,
  TestimonialSiteContentItem,
  TestimonialsSiteContent,
  WhyChooseUsSiteContent,
} from "@/lib/site-content/defaults";

export type {
  CorporateFaqItem,
  CorporateFaqSiteContent,
  CorporateHomepageSiteContent,
  CorporateServiceCard,
  CorporateServicesSiteContent,
  CorporateStatItem,
  CorporateStatsSiteContent,
  DivisionLandingCard,
  DivisionLandingSiteContent,
  PageHeroSiteContentSimple,
} from "@/lib/site-content/corporate-defaults";

export {
  DEFAULT_SITE_CONTENT,
  SITE_CONTENT_SECTIONS,
  mergeSiteContent,
  sectionToDbKey,
  dbKeyToSection,
} from "@/lib/site-content/defaults";

export function resolveHomepageBackground(content: HomepageSiteContent): string {
  if (content.backgroundImage.trim()) {
    return content.backgroundImage.trim();
  }

  const usesVideoBackground =
    content.heroBackgroundMode === "video" ||
    content.backgroundVideoUrl.trim().length > 0 ||
    content.backgroundVideoEmbedUrl.trim().length > 0;

  if (usesVideoBackground) {
    return DEFAULT_HERO_POSTER_URL;
  }

  return vehicleImages.hero;
}

export function resolveHomepageHeroPoster(content: HomepageSiteContent): string {
  return content.backgroundImage.trim() || DEFAULT_HERO_POSTER_URL;
}

export function resolveHomepageHeroVideo(content: HomepageSiteContent): ResolvedVideo | null {
  const hasCmsVideo =
    content.backgroundVideoUrl.trim().length > 0 ||
    content.backgroundVideoEmbedUrl.trim().length > 0;
  const hasCustomImage = content.backgroundImage.trim().length > 0;
  const useVideoBackground =
    content.heroBackgroundMode === "video" ||
    hasCmsVideo ||
    (content.heroBackgroundMode === "image" && !hasCustomImage && !hasCmsVideo);

  if (!useVideoBackground) return null;

  const context = {
    embedMinimalBranding: content.embedMinimalBranding,
    embedHideControls: content.embedHideControls,
    embedHideRelated: content.embedHideRelated,
    background: true as const,
  };

  const fromCms = resolveVideo(
    normalizeMediaUrl(content.backgroundVideoUrl),
    content.backgroundVideoEmbedUrl,
    context
  );
  if (fromCms) return fromCms;

  return { type: "file", url: DEFAULT_HERO_BACKGROUND_VIDEO_URL };
}

export function resolveAboutMissionImage(content: AboutSiteContent): string {
  return content.missionImage.trim() || vehicleImages.showroom;
}

export function resolveAboutQualityImage(content: AboutSiteContent): string {
  return content.qualityImage.trim() || vehicleImages.workshop;
}

async function fetchSiteContentFromDb(): Promise<SiteContent> {
  const supabase = createAdminSupabase();
  if (!supabase) return DEFAULT_SITE_CONTENT;

  const { data, error } = await supabase.from("site_content").select("section, content");

  if (error) {
    console.error("site_content fetch failed:", error.message);
    return DEFAULT_SITE_CONTENT;
  }

  const patch: Partial<Record<SiteContentSection, unknown>> = {};
  for (const row of data ?? []) {
    const section = dbKeyToSection(row.section);
    if (section && row.content) {
      patch[section] = row.content;
    }
  }

  return mergeSiteContent(patch);
}

const getCachedSiteContent = unstable_cache(
  fetchSiteContentFromDb,
  ["site-content-v1"],
  {
    revalidate: SITE_CONTENT_REVALIDATE_SECONDS,
    tags: [SITE_CONTENT_CACHE_TAG],
  }
);

/** Request-scoped dedup + cross-request cache (60s TTL, busted on CMS save). */
export const getSiteContent = cache(getCachedSiteContent);
