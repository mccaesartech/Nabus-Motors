import Link from "next/link";
import { Container } from "@/components/shared/container";
import { ROUTES } from "@/lib/routes";
import { Car, Crown, Leaf, Truck, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NEEDS: { label: string; href: string; icon: LucideIcon; desc: string }[] = [
  {
    label: "Family SUVs",
    href: `${ROUTES.auto.inventory}?bodyType=SUV`,
    icon: Car,
    desc: "Spacious, safe, road-ready",
  },
  {
    label: "Executive Sedans",
    href: `${ROUTES.auto.inventory}?bodyType=Sedan`,
    icon: Crown,
    desc: "Comfort meets prestige",
  },
  {
    label: "Work Trucks",
    href: `${ROUTES.auto.inventory}?bodyType=Truck`,
    icon: Truck,
    desc: "Built for business",
  },
  {
    label: "Electric & Hybrid",
    href: `${ROUTES.auto.inventory}?fuelType=Electric`,
    icon: Leaf,
    desc: "Future-forward driving",
  },
  {
    label: "In Ghana Now",
    href: ROUTES.auto.availableLocally,
    icon: Zap,
    desc: "Immediate delivery",
  },
  {
    label: "Pre-Order Imports",
    href: ROUTES.auto.preorder,
    icon: Car,
    desc: "Source from abroad",
  },
];

export function NabusShopByNeed() {
  return (
    <section className="border-y border-[var(--nabus-border)] bg-[var(--nabus-background)] py-14 sm:py-16">
      <Container>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--nabus-primary)]">
          Shop by Need
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-3xl">
          Find the right fit
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NEEDS.map((need) => {
            const Icon = need.icon;
            return (
              <Link
                key={need.href}
                href={need.href}
                className="group flex items-start gap-4 rounded-2xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-5 transition-all duration-200 hover:border-[var(--nabus-primary)]/30 hover:shadow-[0_8px_24px_rgba(39,35,32,0.06)]"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)] transition-transform duration-200 group-hover:scale-105">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="font-bold text-[var(--nabus-charcoal)]">{need.label}</p>
                  <p className="mt-1 text-sm text-[var(--nabus-text-secondary)]">{need.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
