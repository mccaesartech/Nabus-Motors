import {
  BadgeCheck,
  ClipboardCheck,
  Globe,
  Headphones,
  Package,
  ShieldCheck,
  Ship,
  Wallet,
} from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";

const TRUST_POINTS = [
  {
    icon: BadgeCheck,
    title: "Every listing is reviewed",
    description:
      "Vehicles are added by Nabus Motors — not open public listings. Each unit is vetted before it reaches our inventory.",
  },
  {
    icon: ClipboardCheck,
    title: "Professional inspections",
    description:
      "We document mechanical, structural, and cosmetic condition so you know what you are buying before you commit.",
  },
  {
    icon: Globe,
    title: "Trusted import partners",
    description:
      "China and Japan sourcing through established partners, with clear communication from purchase to port.",
  },
  {
    icon: Wallet,
    title: "Transparent pricing",
    description:
      "List prices, pre-order deposits, and service fees are explained upfront — no hidden surprises at checkout.",
  },
  {
    icon: Ship,
    title: "Freight forwarding expertise",
    description:
      "Our freight division handles RoRo and container logistics from origin port through to Ghana.",
  },
  {
    icon: ShieldCheck,
    title: "Customs clearing assistance",
    description:
      "Documentation, Ghana Customs liaison, and port coordination managed by our clearing team.",
  },
  {
    icon: Package,
    title: "Genuine spare parts",
    description:
      "Source verified parts through Nabus Motors after your purchase — one partner for the full lifecycle.",
  },
  {
    icon: Headphones,
    title: "After-sales support",
    description:
      "Appointments, shipment updates, and advisor access when you need help after delivery.",
  },
];

const COMPACT_TRUST_POINT_IDS = new Set([
  "Every listing is reviewed",
  "Professional inspections",
  "Freight forwarding expertise",
  "Genuine spare parts",
]);

type WhyBuyFromNabusProps = {
  variant?: "full" | "compact";
};

export function WhyBuyFromNabus({ variant = "full" }: WhyBuyFromNabusProps) {
  const points =
    variant === "compact"
      ? TRUST_POINTS.filter((point) => COMPACT_TRUST_POINT_IDS.has(point.title))
      : TRUST_POINTS;

  if (variant === "compact") {
    return (
      <section className="border-y border-border bg-section-warm py-10 sm:py-12">
        <Container>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md">
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                Why Buy From Nabus Motors
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A professional automotive partner — verified inventory, import expertise, and
                after-sales support through one trusted team.
              </p>
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-3xl">
              {points.map((point) => {
                const Icon = point.icon;
                return (
                  <article
                    key={point.title}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/80 px-4 py-3"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-icon-box-border bg-icon-box-bg">
                      <Icon className="size-4 text-icon-box-fg" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {point.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="border-y border-border bg-section-warm py-20 sm:py-24">
      <Container>
        <SectionHeader
          title="Why Buy From Nabus Motors"
          description="A professional automotive partner — not a classifieds site. We guide you from browsing through import, clearing, delivery, and beyond."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {points.map((point) => {
            const Icon = point.icon;
            return (
              <article
                key={point.title}
                className="rounded-xl border border-border/70 bg-card p-6 shadow-luxury transition-shadow duration-300 hover:shadow-luxury-lg"
              >
                <div className="flex size-11 items-center justify-center rounded-lg border border-icon-box-border bg-icon-box-bg">
                  <Icon className="size-5 text-icon-box-fg" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-foreground">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {point.description}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/** @deprecated Use WhyBuyFromNabus */
export const WhyBuyFromTrueGoshen = WhyBuyFromNabus;
