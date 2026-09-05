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

function JourneyServiceCard({ card, featured = false }: { card: DivisionLandingCard; featured?: boolean }) {
  const Icon = resolveSiteContentIcon(card.icon);
  const imageSrc = normalizeMediaUrl(card.image) || card.image;

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-sm border border-border/80 bg-card shadow-luxury transition-all duration-300 hover:-translate-y-0.5 hover:shadow-luxury-lg",
        featured && "lg:flex-row"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          featured ? "aspect-[16/10] lg:aspect-auto lg:min-h-[16rem] lg:w-[42%]" : "aspect-[16/10]"
        )}
      >
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
        <div className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-sm border border-white/25 bg-brand-primary/55 text-white backdrop-blur-sm">
          <Icon className="size-4" strokeWidth={2} />
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col p-5 sm:p-6", featured && "lg:justify-center")}>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{card.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {card.description}
        </p>
        <Button
          size="sm"
          className="mt-5 w-full justify-center gap-2 rounded-sm bg-brand-primary font-semibold tracking-wide text-white hover:bg-brand-charcoal sm:w-auto"
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
    <article className="group flex h-full flex-col overflow-hidden rounded-sm border border-brand-auto-accent/25 bg-card shadow-luxury transition-all duration-300 hover:-translate-y-0.5 hover:shadow-luxury-lg">
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
        <div className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-sm border border-white/25 bg-brand-auto-accent/80 text-white backdrop-blur-sm">
          <Icon className="size-4" strokeWidth={2} />
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
              "justify-center gap-2 rounded-sm bg-brand-auto-accent font-semibold tracking-wide text-white hover:bg-brand-auto-accent-dark"
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
            className="justify-center rounded-sm border-border font-semibold tracking-wide"
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
          className="max-w-xl"
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          {content.cards.map((card, index) => (
            <div
              key={card.id}
              className={cn(
                index === 0 ? "sm:col-span-2 lg:col-span-7" : "lg:col-span-5",
                index === 1 && "lg:col-span-5",
                index >= 2 && "lg:col-span-4"
              )}
            >
              <JourneyServiceCard card={card} featured={index === 0} />
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-5">
            <AdvisorCard advisor={content.advisor} />
          </div>
        </div>
      </Container>
    </section>
  );
}
