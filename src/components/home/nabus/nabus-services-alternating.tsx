import Link from "next/link";
import { Container } from "@/components/shared/container";
import { ROUTES } from "@/lib/routes";
import {
  ClipboardCheck,
  FileText,
  Package,
  Shield,
  Stethoscope,
  Truck,
  Wrench,
  Car,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SERVICES: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Insurance", href: `${ROUTES.corporate.services}#insurance`, icon: Shield },
  { title: "Registration", href: `${ROUTES.corporate.services}#registration`, icon: FileText },
  { title: "Roadworthy", href: `${ROUTES.corporate.services}#roadworthy`, icon: ClipboardCheck },
  { title: "Diagnosis", href: `${ROUTES.corporate.services}#diagnosis`, icon: Stethoscope },
  { title: "After-Sales", href: `${ROUTES.corporate.services}#after-sales`, icon: Wrench },
  { title: "Spare Parts", href: ROUTES.auto.spareParts, icon: Package },
  { title: "Rentals", href: ROUTES.auto.rentals, icon: Car },
  { title: "Freight", href: ROUTES.corporate.freight, icon: Truck },
];

export function NabusServicesAlternating() {
  return (
    <section className="bg-[var(--nabus-surface)] py-14 sm:py-16">
      <Container>
        <h2 className="text-xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-2xl">
          Our Services
        </h2>
        <p className="mt-1 text-sm text-[var(--nabus-text-secondary)]">
          Complete automotive care beyond the sale
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <Link
                key={service.title}
                href={service.href}
                className="group flex items-center gap-4 rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-background)] p-5 transition-all duration-200 hover:border-[var(--nabus-primary)]/30 hover:bg-[var(--nabus-red-soft)]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--nabus-surface)] text-[var(--nabus-primary)] transition-colors group-hover:bg-[var(--nabus-primary)] group-hover:text-white">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="text-sm font-semibold text-[var(--nabus-charcoal)]">
                  {service.title}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
