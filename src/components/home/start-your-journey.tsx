"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContinueYourJourney } from "@/components/home/continue-your-journey";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/constants";
import { resolveSiteContentIcon } from "@/lib/site-content-icons";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import type {
  DivisionLandingCard,
  StartYourJourneyAdvisorContent,
  StartYourJourneySiteContent,
} from "@/lib/site-content/corporate-defaults";
import { cn } from "@/lib/utils";

function JourneyServiceCard({ card }: { card: DivisionLandingCard }) {
  const Icon = resolveSiteContentIcon(card.icon);
  const imageSrc = normalizeMediaUrl(card.image) || card.image;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-luxury transition-all duration-300 hover:-translate-y-0.5 hover:shadow-luxury-lg">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={imageSrc}
          alt={card.imageAlt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black/50 via-transparent to-transparent"
          aria-hidden
        />
        <div className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-lg border border-white/20 bg-brand-black/45 text-white backdrop-blur-sm">
          <Icon className="size-5" strokeWidth={2} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{card.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {card.description}
        </p>
        <Button
          size="sm"
          className="mt-5 w-full justify-center gap-2 rounded-lg bg-brand-purple-dark font-semibold uppercase tracking-[0.08em] text-white hover:bg-brand-purple sm:w-auto"
          render={<Link href={card.href} />}
        >
          {card.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </article>
  );
}

function AdvisorCard({ advisor }: { advisor: StartYourJourneyAdvisorContent }) {
  const Icon = resolveSiteContentIcon("MessageCircle");
  const imageSrc = normalizeMediaUrl(advisor.image) || advisor.image;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-luxury transition-all duration-300 hover:-translate-y-0.5 hover:shadow-luxury-lg">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={imageSrc}
          alt={advisor.imageAlt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black/50 via-transparent to-transparent"
          aria-hidden
        />
        <div className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-lg border border-white/20 bg-brand-black/45 text-white backdrop-blur-sm">
          <Icon className="size-5" strokeWidth={2} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{advisor.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {advisor.description}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            size="sm"
            className={cn(
              "justify-center gap-2 rounded-lg border-2 border-brand-cta-gold/90 bg-brand-cta-gold font-semibold uppercase tracking-[0.08em] text-brand-primary hover:bg-brand-cta-gold-hover"
            )}
            render={
              <a
                href={whatsappUrl(advisor.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            {advisor.primaryLabel}
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-center rounded-lg border-border font-semibold uppercase tracking-[0.08em]"
            render={<Link href={advisor.secondaryHref} />}
          >
            {advisor.secondaryLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

type StartYourJourneyProps = {
  content: StartYourJourneySiteContent;
};

export function StartYourJourney({ content }: StartYourJourneyProps) {
  return (
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <Container>
        <ContinueYourJourney />

        <SectionHeader
          title={content.title}
          description={content.description}
          align="center"
          className="mx-auto"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.cards.map((card) => (
            <JourneyServiceCard key={card.id} card={card} />
          ))}
          <AdvisorCard advisor={content.advisor} />
        </div>
      </Container>
    </section>
  );
}
