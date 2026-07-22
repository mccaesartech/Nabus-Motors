import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";
import {
  ADMIN_PWA,
  ADMIN_PWA_THEME_COLOR,
  CUSTOMER_PWA,
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
} from "./constants";

type RelatedApplication = NonNullable<
  MetadataRoute.Manifest["related_applications"]
>[number];

function relatedApplications(): RelatedApplication[] {
  const origin = getPublicSiteUrl();
  return [
    {
      platform: "webapp",
      url: `${origin}${CUSTOMER_PWA.manifestPath}`,
    },
    {
      platform: "webapp",
      url: `${origin}${ADMIN_PWA.manifestPath}`,
    },
  ];
}

type ManifestIcon = NonNullable<MetadataRoute.Manifest["icons"]>[number];

function customerIcons(): ManifestIcon[] {
  return [
    {
      src: "/icons/icon-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-192x192-maskable.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512x512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];
}

function adminIcons(): ManifestIcon[] {
  return [
    {
      src: "/icons/admin/icon-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/admin/icon-192x192-maskable.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/admin/icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/admin/icon-512x512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];
}

export function buildCustomerManifest(): MetadataRoute.Manifest {
  return {
    id: CUSTOMER_PWA.id,
    name: CUSTOMER_PWA.name,
    short_name: CUSTOMER_PWA.shortName,
    description: CUSTOMER_PWA.description,
    start_url: CUSTOMER_PWA.startUrl,
    scope: CUSTOMER_PWA.scope,
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    categories: ["business", "shopping"],
    icons: customerIcons(),
    related_applications: relatedApplications(),
  };
}

export function buildAdminManifest(): MetadataRoute.Manifest {
  return {
    id: ADMIN_PWA.id,
    name: ADMIN_PWA.name,
    short_name: ADMIN_PWA.shortName,
    description: ADMIN_PWA.description,
    start_url: ADMIN_PWA.startUrl,
    scope: ADMIN_PWA.scope,
    display: "standalone",
    orientation: "any",
    theme_color: ADMIN_PWA_THEME_COLOR,
    background_color: ADMIN_PWA_THEME_COLOR,
    categories: ["business", "productivity"],
    icons: adminIcons(),
    related_applications: relatedApplications(),
  };
}
