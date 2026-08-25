import { Container } from "@/components/shared/container";
import { HeroBackgroundVideo } from "@/components/shared/hero-background-video";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { Button } from "@/components/ui/button";
import {
  resolveHomepageBackground,
  resolveHomepageHeroPoster,
  resolveHomepageHeroVideo,
} from "@/lib/site-content";
import type { HomepageSiteContent } from "@/lib/site-content/defaults";
import Link from "next/link";

type HeroProps = {
  content: HomepageSiteContent;
};

export function Hero({ content }: HeroProps) {
  const backgroundSrc = resolveHomepageBackground(content);
  const posterSrc = resolveHomepageHeroPoster(content);
  const video = resolveHomepageHeroVideo(content);

  return (
    <section className="relative min-h-[calc(100dvh-var(--header-height))] w-full min-w-0 overflow-hidden bg-brand-charcoal-dark">
      <div className="absolute inset-0 z-0 overflow-hidden">
        {video ? (
          <HeroBackgroundVideo
            video={video}
            poster={posterSrc}
            objectFit="cover"
          />
        ) : (
          <SafeVehicleImage
            src={backgroundSrc}
            alt="Premium luxury vehicle"
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
      </div>

      {/* Gradient overlay — between video (z-0) and content (z-10) */}
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        {/* Light top — keep video visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/10 via-transparent to-transparent" />
        {/* Mid/center vignette behind headline + CTAs */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_52%,rgba(15,5,30,0.55)_0%,rgba(46,16,101,0.28)_45%,transparent_78%)] sm:bg-[radial-gradient(ellipse_90%_70%_at_50%_52%,rgba(15,5,30,0.72)_0%,rgba(46,16,101,0.42)_45%,transparent_78%)]" />
        {/* Vertical blend — subtle top, stronger toward bottom; lighter on mobile */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/50 via-brand-purple-dark/25 to-brand-black/10 sm:from-brand-black/75 sm:via-brand-purple-dark/40 sm:to-brand-black/15" />
        {/* Bottom band for button legibility — shorter/lighter on mobile */}
        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-brand-black/55 via-brand-purple-dark/30 to-transparent sm:h-[38%] sm:from-brand-black/80 sm:via-brand-purple-dark/50 lg:h-1/2" />
      </div>

      <Container className="relative z-10 flex min-h-[calc(100dvh-var(--header-height))] w-full items-center justify-center py-12 sm:py-20">
        <div className="relative z-20 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <p className="hero-fade-in-subtle hero-fade-in-delay-1 text-xs font-semibold uppercase tracking-[0.26em] text-brand-cta-gold drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)] sm:text-sm">
            {content.eyebrow}
          </p>

          <h1 className="mt-4 text-balance text-3xl font-bold leading-[1.06] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)] sm:mt-5 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
            {content.title}
          </h1>

          <p className="hero-fade-in-subtle hero-fade-in-delay-2 mt-5 max-w-2xl text-base leading-relaxed text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:mt-6 sm:text-lg md:text-xl">
            {content.subtitle}
          </p>

          <div className="hero-fade-in-subtle hero-fade-in-delay-3 relative z-20 mt-8 flex w-full min-w-0 flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
            <Button
              size="lg"
              className="min-h-12 w-auto max-w-fit justify-center rounded-xl border-2 border-brand-cta-gold/90 bg-brand-cta-gold px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_4px_24px_rgba(201,162,39,0.45),0_2px_8px_rgba(0,0,0,0.35)] transition-all hover:border-brand-cta-gold-hover hover:bg-brand-cta-gold-hover hover:shadow-[0_6px_28px_rgba(201,162,39,0.55),0_2px_10px_rgba(0,0,0,0.4)]"
              render={<Link href={content.ctaPrimaryHref} />}
            >
              {content.ctaPrimaryLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 w-auto max-w-fit justify-center rounded-xl border-2 border-brand-cta-gold bg-brand-purple-dark/85 px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all hover:border-brand-cta-gold hover:bg-brand-purple-dark hover:shadow-[0_6px_24px_rgba(201,162,39,0.25),0_2px_10px_rgba(0,0,0,0.45)]"
              render={<Link href={content.ctaSecondaryHref} />}
            >
              {content.ctaSecondaryLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 w-auto max-w-fit justify-center rounded-xl border-2 border-white/70 bg-white/10 px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all hover:border-white hover:bg-white/20 hover:shadow-[0_6px_24px_rgba(255,255,255,0.12),0_2px_10px_rgba(0,0,0,0.4)]"
              render={<Link href={content.ctaTertiaryHref} />}
            >
              {content.ctaTertiaryLabel}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
