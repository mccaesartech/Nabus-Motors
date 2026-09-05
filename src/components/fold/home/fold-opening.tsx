import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { FoldCrease, FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";
import type { HomepageSiteContent } from "@/lib/site-content/defaults";
import {
  resolveHomepageBackground,
  resolveHomepageHeroPoster,
  resolveHomepageHeroVideo,
} from "@/lib/site-content";
import { HeroBackgroundVideo } from "@/components/shared/hero-background-video";

type FoldOpeningProps = {
  content: HomepageSiteContent;
  heroVehicle?: Vehicle;
};

export function FoldOpening({ content, heroVehicle }: FoldOpeningProps) {
  const backgroundSrc = resolveHomepageBackground(content);
  const posterSrc = resolveHomepageHeroPoster(content);
  const video = resolveHomepageHeroVideo(content);
  const photo = heroVehicle ? primaryPhotoFor(heroVehicle) : backgroundSrc;

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[var(--nabus-graphite)] text-[var(--nabus-paper)]">
      <div className="absolute inset-0">
        {video ? (
          <HeroBackgroundVideo video={video} poster={posterSrc} layout="landscape" />
        ) : (
          <SafeVehicleImage
            src={photo}
            alt=""
            className="h-full w-full object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-[var(--nabus-graphite)]/55 lg:bg-transparent lg:bg-gradient-to-r lg:from-[var(--nabus-graphite)]/88 lg:via-[var(--nabus-graphite)]/35 lg:to-transparent" />
      </div>

      <FoldCrease className="top-[28%] left-0 w-[55%] max-w-none opacity-80" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[92rem] flex-col justify-end px-4 pb-10 pt-[calc(var(--header-height)+1.5rem)] sm:px-6 lg:px-8 xl:px-10">
        <div className="w-full max-w-[28rem] pb-2">
          <FoldIndex n="01" tone="ink" />
          <h1 className="font-display mt-4 text-[clamp(2.6rem,7vw,5.4rem)] leading-[1.05] tracking-[-0.03em] text-[var(--nabus-paper)]">
            The Dzorwulu
            <br />
            <em className="italic">showroom.</em>
          </h1>
          <p className="mt-5 max-w-[22rem] text-[15px] leading-relaxed text-white/72">
            {content.subtitle?.includes("Award") || !content.subtitle
              ? "Cars chosen on the floor in Accra. Inspected, priced, ready to reserve."
              : content.subtitle}
          </p>
          <Link
            href={ROUTES.auto.inventory}
            className="mt-7 inline-flex text-[14px] font-medium text-[var(--nabus-paper)] underline decoration-[var(--nabus-gold)] underline-offset-8 hover:text-[var(--nabus-gold)]"
          >
            Open the catalogue
          </Link>
        </div>
      </div>
    </section>
  );
}
