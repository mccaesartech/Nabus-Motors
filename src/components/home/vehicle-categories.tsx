import Link from "next/link";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { SiteVideoEmbed } from "@/components/shared/site-video";
import { categories as inventoryCategories } from "@/lib/data/vehicles";
import { resolveCategoryImage } from "@/lib/site-content/media-url";
import { resolveSiteContentIcon } from "@/lib/site-content-icons";
import type { BrowseByCategorySiteContent } from "@/lib/site-content/defaults";
import { resolveVideo } from "@/lib/site-content/video";

type VehicleCategoriesProps = {
  content: BrowseByCategorySiteContent;
};

function resolveCategoryHref(href: string, slug: string): string {
  const trimmed = href.trim();
  if (trimmed) return trimmed;
  return `/auto/inventory?bodyType=${slug}`;
}

function resolveCategoryCount(id: string, slug: string): number {
  const match =
    inventoryCategories.find((c) => c.id === id) ??
    inventoryCategories.find((c) => c.slug === slug);
  return match?.count ?? 0;
}

export function VehicleCategories({ content }: VehicleCategoriesProps) {
  const video = resolveVideo(content.videoUrl, content.videoEmbedUrl, {
    embedMinimalBranding: content.embedMinimalBranding,
    embedHideControls: content.embedHideControls,
    embedHideRelated: content.embedHideRelated,
  });
  const backgroundImage = content.backgroundImage.trim();

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <SectionHeader title={content.title} description={content.description} />

        {video && (
          <div className="mb-10 overflow-hidden rounded-lg border border-border bg-black shadow-lg">
            <SiteVideoEmbed
              url={content.videoEmbedUrl.trim() || content.videoUrl.trim()}
              title={content.title}
              display={{
                videoAspect: content.videoAspect,
                videoSize: content.videoSize,
                videoObjectFit: content.videoObjectFit,
              }}
              embed={{
                embedMinimalBranding: content.embedMinimalBranding,
                embedHideControls: content.embedHideControls,
                embedHideRelated: content.embedHideRelated,
              }}
            />
          </div>
        )}

        {!video && backgroundImage && (
          <div className="relative mb-10 aspect-[21/9] overflow-hidden rounded-lg">
            <SafeVehicleImage
              src={backgroundImage}
              alt=""
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-black/40 to-transparent" />
          </div>
        )}

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {content.categories.map((category) => {
            const count = resolveCategoryCount(category.id, category.slug);
            const image = resolveCategoryImage(category.id, category.slug, category.image);
            const Icon = category.icon ? resolveSiteContentIcon(category.icon) : null;

            return (
              <Link
                key={category.id}
                href={resolveCategoryHref(category.href, category.slug)}
                className="group relative aspect-[16/10] overflow-hidden"
              >
                {image ? (
                  <SafeVehicleImage
                    src={image}
                    alt={category.label}
                    className="transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : Icon ? (
                  <div className="flex h-full w-full items-center justify-center bg-brand-charcoal">
                    <Icon className="size-12 text-white/80" strokeWidth={1.5} />
                  </div>
                ) : (
                  <div className="h-full w-full bg-brand-charcoal" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="text-lg font-semibold text-white">{category.label}</h3>
                  <p className="mt-1 text-sm text-white/70">
                    {count} vehicle{count !== 1 ? "s" : ""} available
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
