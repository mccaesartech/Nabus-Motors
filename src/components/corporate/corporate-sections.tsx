import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { HeroBackgroundVideo } from "@/components/shared/hero-background-video";
import { SectionHeader } from "@/components/shared/section-header";
import { ServiceImageCardGrid } from "@/components/shared/service-image-card";
import { Button } from "@/components/ui/button";
import { CORPORATE_HERO_POSTER_URL, CORPORATE_HERO_VIDEO_MOBILE_URL, CORPORATE_HERO_VIDEO_URL } from "@/lib/constants";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import type {
  CorporateFaqSiteContent,
  CorporateHomepageSiteContent,
  CorporateServicesSiteContent,
  CorporateStatsSiteContent,
} from "@/lib/site-content/corporate-defaults";

type CorporateHeroProps = {
  content: CorporateHomepageSiteContent;
};

export function CorporateHero({ content }: CorporateHeroProps) {
  const videoUrl = normalizeMediaUrl(content.heroVideoUrl) || CORPORATE_HERO_VIDEO_URL;
  const posterUrl = normalizeMediaUrl(content.heroPosterUrl) || CORPORATE_HERO_POSTER_URL;
  const video = { type: "file" as const, url: videoUrl };

  return (
    <section className="relative min-h-[calc(100dvh-var(--header-height))] w-full overflow-hidden bg-brand-charcoal-dark">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <HeroBackgroundVideo
          video={video}
          poster={posterUrl}
          objectFit="cover"
          layout="landscape"
          fallbackVideoUrl={null}
          mobileVideoUrl={CORPORATE_HERO_VIDEO_MOBILE_URL}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(91,33,182,0.42)_0%,rgba(15,5,30,0.88)_70%)] sm:bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(91,33,182,0.35)_0%,rgba(15,5,30,0.9)_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_52%,rgba(15,5,30,0.55)_0%,rgba(46,16,101,0.32)_45%,transparent_78%)] sm:bg-[radial-gradient(ellipse_90%_70%_at_50%_52%,rgba(15,5,30,0.72)_0%,rgba(46,16,101,0.42)_45%,transparent_78%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/55 via-brand-purple-dark/30 to-brand-black/20 sm:from-brand-black/80 sm:via-brand-purple-dark/45 sm:to-brand-black/25" />
        <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-brand-black/60 via-brand-purple-dark/35 to-transparent sm:h-[38%] sm:from-brand-black/85 sm:via-brand-purple-dark/50" />
      </div>

      <Container className="relative z-10 flex min-h-[calc(100dvh-var(--header-height))] items-center py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-cta-gold drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)] sm:text-sm">
            {content.heroEyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)] sm:text-4xl md:text-5xl lg:text-6xl">
            {content.heroTitle}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/90 drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:text-lg md:text-xl">
            {content.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Button
              size="lg"
              className="min-h-12 border-2 border-brand-cta-gold/90 bg-brand-cta-gold px-6 font-bold uppercase tracking-[0.12em] text-white hover:bg-brand-cta-gold-hover"
              render={<Link href={content.ctaPrimaryHref} />}
            >
              {content.ctaPrimaryLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 border-white/40 bg-white/5 px-6 text-white hover:bg-white/10"
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
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <SectionHeader
            title={content.aboutTitle}
            description={content.aboutDescription}
            className="mb-0"
          />
          <ul className="space-y-3">
            {content.aboutSpecialties.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-cta-gold" />
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
    <section className="border-b border-border bg-muted py-16 sm:py-20">
      <Container>
        <SectionHeader
          title={content.title}
          description={content.description}
          align="center"
          className="mx-auto"
        />
        <ServiceImageCardGrid
          cards={content.cards.map((service) => ({
            id: service.id,
            title: service.title,
            subtitle: service.subtitle,
            image: service.image,
            imageAlt: service.imageAlt,
            href: service.href,
          }))}
        />
      </Container>
    </section>
  );
}

type CorporateStatsProps = {
  content: CorporateStatsSiteContent;
};

export function CorporateStats({ content }: CorporateStatsProps) {
  return (
    <section className="border-b border-border bg-brand-black py-14 sm:py-16">
      <Container>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {content.items.map((stat) => (
            <div key={stat.id} className="text-center">
              <p className="text-3xl font-bold text-brand-cta-gold sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm text-white/70">{stat.label}</p>
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
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <Container>
        <SectionHeader
          title={content.title}
          description={content.description}
          align="center"
          className="mx-auto"
        />
        <div className="mx-auto max-w-3xl divide-y divide-border rounded-xl border border-border bg-card shadow-luxury">
          {content.items.map((item) => (
            <details key={item.id} className="group px-6 py-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
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
    <section className="bg-section-warm py-16 sm:py-20">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeader
            title={content.contactCtaTitle}
            description={content.contactCtaDescription}
            align="center"
            className="mx-auto"
          />
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" render={<Link href={content.contactCtaPrimaryHref} />}>
              {content.contactCtaPrimaryLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
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
