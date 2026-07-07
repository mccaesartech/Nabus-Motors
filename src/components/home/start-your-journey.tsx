"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Clock,
  MessageCircle,
  Package,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { ContinueYourJourney } from "@/components/home/continue-your-journey";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { whatsappUrl } from "@/lib/constants";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import { cn } from "@/lib/utils";

type JourneyCard = {
  id: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
  icon: LucideIcon;
  external?: boolean;
};

const JOURNEY_CARDS: JourneyCard[] = [
  {
    id: "buy-vehicle",
    title: "Buy a Vehicle in Ghana",
    description:
      "Browse verified stock with transparent pricing, inspection reports, and professional support.",
    cta: "Browse Available Vehicles",
    href: ROUTES.auto.home,
    image: "/images/services/buy-vehicle.jpg",
    imageAlt: "Premium vehicles available for purchase in Ghana",
    icon: Car,
  },
  {
    id: "pre-order",
    title: "Pre-Order from China/Japan",
    description:
      "Reserve imports from China, Japan, and other markets with a structured pre-order process.",
    cta: "Pre-Order a Vehicle",
    href: ROUTES.auto.preorder,
    image: "/images/services/china-japan-imports.jpg",
    imageAlt: "International vehicle imports from China and Japan",
    icon: Clock,
  },
  {
    id: "freight",
    title: "Freight & Customs",
    description:
      "End-to-end shipping, documentation, and Ghana customs clearing for vehicles and cargo.",
    cta: "Freight Services",
    href: ROUTES.corporate.freight,
    image: "/images/services/freight-containers.jpg",
    imageAlt: "Freight containers and international shipping logistics",
    icon: Ship,
  },
  {
    id: "spare-parts",
    title: "Genuine Spare Parts",
    description:
      "OEM and aftermarket parts for popular makes — browse the catalogue or request specific items.",
    cta: "Browse Spare Parts",
    href: ROUTES.auto.spareParts,
    image: "/images/services/spare-parts.jpg",
    imageAlt: "Genuine automotive spare parts",
    icon: Package,
  },
  {
    id: "appointment",
    title: "Book Inspection/Test Drive",
    description:
      "Schedule a showroom visit to inspect vehicles in person or arrange a test drive with our team.",
    cta: "Book Appointment",
    href: ROUTES.corporate.appointments,
    image: "/images/services/buy-vehicle.jpg",
    imageAlt: "Customer inspecting a vehicle at the showroom",
    icon: CalendarCheck,
  },
];

const ADVISOR_MESSAGE =
  "Hello True Goshen, I would like to speak with an advisor about your services.";

function JourneyServiceCard({ card }: { card: JourneyCard }) {
  const Icon = card.icon;
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
          className="mt-5 w-full justify-center gap-2 rounded-lg bg-brand-purple font-semibold uppercase tracking-[0.08em] text-white hover:bg-brand-purple-dark sm:w-auto"
          render={
            card.external ? (
              <a href={card.href} target="_blank" rel="noopener noreferrer" />
            ) : (
              <Link href={card.href} />
            )
          }
        >
          {card.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </article>
  );
}

function AdvisorCard() {
  const imageSrc =
    normalizeMediaUrl("/images/services/personalised-advice.jpg") ||
    "/images/services/personalised-advice.jpg";

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-luxury transition-all duration-300 hover:-translate-y-0.5 hover:shadow-luxury-lg">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={imageSrc}
          alt="True Goshen advisor ready to assist"
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black/50 via-transparent to-transparent"
          aria-hidden
        />
        <div className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-lg border border-white/20 bg-brand-black/45 text-white backdrop-blur-sm">
          <MessageCircle className="size-5" strokeWidth={2} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          Speak With Advisor
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          Get personalised guidance on vehicles, shipping, parts, or your next step — by WhatsApp or
          our contact team.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            size="sm"
            className={cn(
              "justify-center gap-2 rounded-lg border-2 border-brand-cta-gold/90 bg-brand-cta-gold font-semibold uppercase tracking-[0.08em] text-white hover:bg-brand-cta-gold-hover"
            )}
            render={
              <a
                href={whatsappUrl(ADVISOR_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Talk to an Expert
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-center rounded-lg border-border font-semibold uppercase tracking-[0.08em]"
            render={<Link href={ROUTES.corporate.contact} />}
          >
            Contact Us
          </Button>
        </div>
      </div>
    </article>
  );
}

export function StartYourJourney() {
  return (
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <Container>
        <ContinueYourJourney />

        <SectionHeader
          title="How can we help you today?"
          description="Choose the service you need — our divisions work together under one trusted brand."
          align="center"
          className="mx-auto"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY_CARDS.map((card) => (
            <JourneyServiceCard key={card.id} card={card} />
          ))}
          <AdvisorCard />
        </div>
      </Container>
    </section>
  );
}
