import Link from "next/link";
import { Container } from "@/components/shared/container";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { BadgeCheck, ShieldCheck, Truck } from "lucide-react";
import type { HomepageSiteContent } from "@/lib/site-content/defaults";
import {
  resolveHomepageBackground,
  resolveHomepageHeroPoster,
  resolveHomepageHeroVideo,
} from "@/lib/site-content";
import { HeroBackgroundVideo } from "@/components/shared/hero-background-video";

type NabusHeroProps = {
  content: HomepageSiteContent;
};

const TRUST_ITEMS = [
  { icon: BadgeCheck, label: "Verified inventory" },
  { icon: Truck, label: "Import to doorstep" },
  { icon: ShieldCheck, label: "Transparent pricing" },
];

export function NabusHero({ content }: NabusHeroProps) {
  const backgroundSrc = resolveHomepageBackground(content);
  const posterSrc = resolveHomepageHeroPoster(content);
  const video = resolveHomepageHeroVideo(content);

  return (
    <section className="bg-[var(--nabus-surface)] py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-[var(--nabus-text-secondary)]">
              Welcome to Nabus Motors
            </p>
            <h1 className="mt-3 text-[2rem] font-bold leading-tight tracking-tight text-[var(--nabus-charcoal)] sm:text-[2.125rem] lg:text-[2.125rem]">
              Dream It.{" "}
              <span className="text-[var(--nabus-primary)]">Drive It.</span> Live It.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--nabus-text-secondary)]">
              {content.subtitle ||
                "Verified vehicles, seamless imports, flexible financing, and full-service automotive care in Accra."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="rounded-lg bg-[var(--nabus-primary)] px-6 hover:bg-[var(--nabus-primary-hover)]"
                render={<Link href={ROUTES.auto.inventory} />}
              >
                Explore Cars
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-lg border-[var(--nabus-input-border)] px-6"
                render={<Link href={ROUTES.auto.preorder} />}
              >
                Import a Car
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 border-t border-[var(--nabus-border)] pt-8">
              {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-[var(--nabus-charcoal)]">
                  <Icon className="size-4 text-[var(--nabus-primary)]" strokeWidth={1.75} />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-background)] shadow-[0_4px_24px_rgba(24,24,24,0.06)]">
              <div className="relative aspect-[4/3]">
                {video ? (
                  <HeroBackgroundVideo video={video} poster={posterSrc} objectFit="cover" />
                ) : (
                  <SafeVehicleImage
                    src={backgroundSrc}
                    alt="Featured vehicle"
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
