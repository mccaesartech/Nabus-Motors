import Link from "next/link";
import {
  ArrowRightLeft,
  Car,
  CalendarCheck,
  PackageSearch,
  Ship,
} from "lucide-react";
import { Container } from "@/components/shared/container";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: ROUTES.auto.inventory, label: "Buy", icon: Car },
  { href: ROUTES.auto.preorder, label: "Import", icon: Ship },
  { href: ROUTES.auto.sell, label: "Sell/Swap", icon: ArrowRightLeft },
  { href: ROUTES.auto.rentals, label: "Rent", icon: PackageSearch },
  { href: `${ROUTES.corporate.services}#diagnosis`, label: "Book Service", icon: CalendarCheck },
] as const;

export function NabusQuickActionDock() {
  return (
    <section className="border-b border-[var(--nabus-border)] bg-[var(--nabus-surface)] py-4">
      <Container>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center sm:gap-4 [&::-webkit-scrollbar]:hidden">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "group flex shrink-0 items-center gap-2.5 rounded-lg border border-[var(--nabus-border)] bg-[var(--nabus-surface)] px-4 py-3 transition-all duration-200",
                  "hover:border-[var(--nabus-primary)]/30 hover:bg-[var(--nabus-red-soft)]"
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--nabus-background)] text-[var(--nabus-primary)] transition-colors group-hover:bg-[var(--nabus-primary)] group-hover:text-white">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="text-sm font-semibold text-[var(--nabus-charcoal)]">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
