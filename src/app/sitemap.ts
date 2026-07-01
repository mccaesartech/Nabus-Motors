import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicSiteUrl();
  const now = new Date();

  const paths = [
    "",
    "/about",
    "/services",
    "/contact",
    "/freight-forwarding",
    "/freight-forwarding/tracking",
    "/shipping-consultation",
    "/auto",
    "/auto/inventory",
    "/auto/buy",
    "/auto/sell",
    "/auto/financing",
    "/auto/garage",
    "/auto/spare-parts",
    "/privacy",
    "/terms",
  ];

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/auto" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/auto" ? 0.9 : 0.7,
  }));
}
