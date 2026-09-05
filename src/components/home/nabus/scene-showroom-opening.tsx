import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { NabusArc } from "@/components/nabus/nabus-arc";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { ROUTES } from "@/lib/routes";
import type { HomepageSiteContent } from "@/lib/site-content/defaults";
import {
  resolveHomepageBackground,
  resolveHomepageHeroPoster,
  resolveHomepageHeroVideo,
} from "@/lib/site-content";
import { HeroBackgroundVideo } from "@/components/shared/hero-background-video";

type SceneShowroomOpeningProps = {
  content: HomepageSiteContent;
  heroVehicle?: Vehicle;
};

export function SceneShowroomOpening({ content, heroVehicle }: SceneShowroomOpeningProps) {
  const backgroundSrc = resolveHomepageBackground(content);
  const posterSrc = resolveHomepageHeroPoster(content);
  const video = resolveHomepageHeroVideo(content);
  const photo = heroVehicle ? primaryPhotoFor(heroVehicle) : backgroundSrc;

  return (
    <section className="relative min-h-[min(100dvh,920px)] bg-[var(--nabus-warm-graphite)] text-[var(--nabus-paper)]">
      <div className="absolute inset-0">
        {video ? (
          <HeroBackgroundVideo video={video} poster={posterSrc} layout="landscape" />
        ) : (
          <SafeVehicleImage
            src={photo}
            alt=""
            className="h-full w-full object-cover opacity-90"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--nabus-graphite)]/92 via-[var(--nabus-graphite)]/55 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[min(100dvh,920px)] max-w-[90rem] flex-col justify-end px-4 pb-8 pt-[calc(var(--header-height)+2rem)] sm:px-6 lg:px-10 xl:px-12">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div className="max-w-xl">
            <NabusSectionLabel tone="dark" showArc={false}>
              Showroom Opening
            </NabusSectionLabel>
            <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.05] tracking-tight">
              FIND YOUR
              <br />
              NEXT DRIVE.
            </h1>
            <NabusArc className="mt-6 max-w-[200px]" variant="gold" />
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/75">
              {content.subtitle ||
                "Verified inventory, import expertise, and financing — from a showroom built for Accra."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={ROUTES.auto.inventory}
                className="inline-flex h-11 items-center border border-[var(--nabus-gold)] bg-[var(--nabus-gold)] px-6 text-sm font-semibold uppercase tracking-wide text-[var(--nabus-graphite)] transition-colors duration-200 hover:bg-[var(--nabus-gold-bright)]"
              >
                Browse Cars
              </Link>
              <Link
                href={ROUTES.corporate.contact}
                className="inline-flex h-11 items-center border border-white/30 px-6 text-sm font-semibold uppercase tracking-wide text-white transition-colors duration-200 hover:border-[var(--nabus-gold)] hover:text-[var(--nabus-gold)]"
              >
                Visit Showroom
              </Link>
            </div>
          </div>

          {heroVehicle ? (
            <div className="hidden lg:block">
              <Link
                href={ROUTES.auto.inventoryDetail(heroVehicle.slug)}
                className="group block border border-white/15 bg-black/20 p-4 backdrop-blur-sm transition-colors hover:border-[var(--nabus-gold)]/50"
              >
                <SafeVehicleImage
                  src={primaryPhotoFor(heroVehicle)}
                  alt={formatVehicleName(heroVehicle)}
                  className="aspect-[16/10] w-full object-cover"
                />
                <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-[var(--nabus-gold)]">
                  Featured
                </p>
                <p className="mt-1 text-lg font-semibold group-hover:text-[var(--nabus-gold)]">
                  {formatVehicleName(heroVehicle)}
                </p>
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-white/15 pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
          <span>Dzorwulu · Accra</span>
          <span>Verified Inventory</span>
          <span>Import & Finance</span>
          <span className="text-[var(--nabus-gold)]">Open Today</span>
        </div>
      </div>
    </section>
  );
}
