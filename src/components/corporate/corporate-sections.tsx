import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CorporateStatValue } from "@/components/corporate/corporate-stat-value";
import { Container } from "@/components/shared/container";
import { DeferredHeroBackgroundVideo } from "@/components/shared/deferred-hero-background-video";
import { SectionHeader } from "@/components/shared/section-header";
import { ServiceImageCard } from "@/components/shared/service-image-card";
import { Button } from "@/components/ui/button";
import { CORPORATE_HERO_POSTER_URL, CORPORATE_HERO_VIDEO_MOBILE_URL, CORPORATE_HERO_VIDEO_URL } from "@/lib/constants";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import type {
  CorporateFaqSiteContent,
  CorporateHomepageSiteContent,
  CorporateServicesSiteContent,
  CorporateStatsSiteContent,
} from "@/lib/site-content/corporate-defaults";
import { cn } from "@/lib/utils";

type CorporateHeroProps = {
  content: CorporateHomepageSiteContent;
};

export function CorporateHero({ content }: CorporateHeroProps) {
  const videoUrl = normalizeMediaUrl(content.heroVideoUrl) || CORPORATE_HERO_VIDEO_URL;
  const posterUrl = normalizeMediaUrl(content.heroPosterUrl) || CORPORATE_HERO_POSTER_URL;
  const video = { type: "file" as const, url: videoUrl };

  return (
    <section className="relative min-h-[min(92dvh,calc(100dvh-var(--header-height)))] w-full overflow-hidden bg-brand-charcoal-dark">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={posterUrl}
          alt=""
          aria-hidden
          fill
          preload
          sizes="100vw"
          decoding="async"
          className="object-cover object-[center_35%]"
        />
        <DeferredHeroBackgroundVideo
          video={video}
          poster={posterUrl}
          objectFit="cover"
          layout="landscape"
          fallbackVideoUrl={null}
          mobileVideoUrl={CORPORATE_HERO_VIDEO_MOBILE_URL}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-charcoal-dark/95 via-brand-primary/75 to-brand-charcoal-dark/35 sm:from-brand-charcoal-dark/92 sm:via-brand-primary/55 sm:to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_15%_45%,rgba(200,84,31,0.18)_0%,transparent_62%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-brand-auto-accent" />
        <div className="absolute inset-x-0 bottom-0 h-[32%] bg-gradient-to-t from-brand-charcoal-dark/90 via-brand-primary/25 to-transparent sm:h-[40%]" />
      </div>

      <Container className="relative z-10 flex min-h-[min(92dvh,calc(100dvh-var(--header-height)))] items-end pb-14 pt-28 sm:items-center sm:pb-20 sm:pt-24">
        <div className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-10 bg-brand-auto-accent" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-brand-auto-accent-light sm:text-xs">
              {content.heroEyebrow}
            </p>
          </div>
          <h1 className="text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-white">
            {content.heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            {content.heroSubtitle}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="lg"
              className="min-h-12 gap-2 rounded-sm bg-brand-auto-accent px-7 font-semibold tracking-wide text-white hover:bg-brand-auto-accent-dark"
              render={<Link href={content.ctaPrimaryHref} />}
            >
              {content.ctaPrimaryLabel}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 rounded-sm border-white/35 bg-transparent px-7 text-white hover:bg-white/10"
              render={<Link href={content.ctaSecondaryHref} />}
            >
              {content.ctaSecondaryLabel}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

type CorporateAboutProps = {
  content: CorporateHomepageSiteContent;
};

export function CorporateAbout({ content }: CorporateAboutProps) {
  return (
    <section className="border-b border-border bg-section-warm py-16 sm:py-20">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="border-l-4 border-brand-auto-accent pl-6 sm:pl-8">
            <SectionHeader
              title={content.aboutTitle}
              description={content.aboutDescription}
              className="mb-0 max-w-none"
            />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {content.aboutSpecialties.map((item, index) => (
              <li
                key={item}
                className="flex gap-3 rounded-sm border border-border/80 bg-card px-4 py-3.5 text-sm leading-relaxed text-muted-foreground shadow-luxury"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-brand-auto-accent/10 text-xs font-bold text-brand-auto-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

type CorporateServicesProps = {
  content: CorporateServicesSiteContent;
};

export function CorporateServices({ content }: CorporateServicesProps) {
  return (
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <Container>
        <SectionHeader
          title={content.title}
          description={content.description}
          className="max-w-xl"
        />
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {content.cards.map((service, index) => (
            <div
              key={service.id}
              className={cn(
                "w-[min(82vw,18rem)] shrink-0 snap-start sm:w-auto",
                index === 0 && "sm:col-span-2 sm:row-span-1"
              )}
            >
              <ServiceImageCard
                id={service.id}
                title={service.title}
                subtitle={service.subtitle}
                image={service.image}
                imageAlt={service.imageAlt}
                href={service.href}
                priority={index === 0}
                className={cn(
                  "w-full sm:w-full sm:h-auto",
                  index === 0 ? "aspect-[16/9] sm:aspect-[2.2/1]" : "aspect-[4/3] sm:aspect-[4/3]"
                )}
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

type CorporateStatsProps = {
  content: CorporateStatsSiteContent;
};

export function CorporateStats({ content }: CorporateStatsProps) {
  return (
    <section className="border-b border-border bg-brand-primary py-14 sm:py-16">
      <Container>
        <div className="divide-y divide-white/10 sm:divide-y-0 sm:grid sm:grid-cols-2 sm:gap-px sm:overflow-hidden sm:rounded-sm sm:border sm:border-white/10 lg:grid-cols-4">
          {content.items.map((stat) => (
            <div
              key={stat.id}
              className="px-2 py-6 text-left first:pt-0 last:pb-0 sm:border-r sm:border-white/10 sm:bg-brand-charcoal/40 sm:px-6 sm:py-8 sm:last:border-r-0"
            >
              <p className="text-3xl font-bold tabular-nums text-brand-auto-accent-light sm:text-4xl">
                <CorporateStatValue value={stat.value} />
              </p>
              <p className="mt-2 text-sm uppercase tracking-[0.14em] text-white/65">{stat.label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

type CorporateFaqProps = {
  content: CorporateFaqSiteContent;
};

export function CorporateFaq({ content }: CorporateFaqProps) {
  return (
    <section className="border-b border-border bg-section-warm py-16 sm:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          <SectionHeader
            title={content.title}
            description={content.description}
            className="mb-0 lg:sticky lg:top-28"
          />
          <div className="divide-y divide-border border-y border-border">
            {content.items.map((item) => (
              <details key={item.id} className="group border-l-2 border-transparent py-5 pl-4 open:border-brand-auto-accent">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    <ArrowRight className="size-3.5 text-brand-auto-accent transition-transform group-open:rotate-90" />
                    {item.question}
                  </span>
                </summary>
                <p className="mt-3 pl-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

type CorporateContactCtaProps = {
  content: CorporateHomepageSiteContent;
};

export function CorporateContactCta({ content }: CorporateContactCtaProps) {
  return (
    <section className="relative overflow-hidden bg-brand-charcoal-dark py-16 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_0%,rgba(200,84,31,0.22)_0%,transparent_55%)]"
        aria-hidden
      />
      <Container>
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
          <SectionHeader
            title={content.contactCtaTitle}
            description={content.contactCtaDescription}
            className="mb-0 max-w-xl [&_h2]:text-white [&_p]:text-white/75"
          />
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Button
              size="lg"
              className="min-h-12 rounded-sm bg-brand-auto-accent px-7 hover:bg-brand-auto-accent-dark"
              render={<Link href={content.contactCtaPrimaryHref} />}
            >
              {content.contactCtaPrimaryLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 rounded-sm border-white/30 bg-transparent text-white hover:bg-white/10"
              render={<Link href={content.contactCtaSecondaryHref} />}
            >
              {content.contactCtaSecondaryLabel}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
