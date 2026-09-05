import { BadgeCheck, Headphones, ShieldCheck, Truck } from "lucide-react";
import { Container } from "@/components/shared/container";

const ADVANTAGES = [
  {
    icon: BadgeCheck,
    title: "Verified Inventory",
    description: "Every vehicle inspected and documented before listing.",
  },
  {
    icon: Truck,
    title: "Import to Doorstep",
    description: "Global sourcing with full clearing and delivery support.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent Pricing",
    description: "No hidden fees — know your total cost upfront.",
  },
  {
    icon: Headphones,
    title: "Dedicated Support",
    description: "Real advisors from inquiry through after-sales.",
  },
];

export function NabusAdvantageBand() {
  return (
    <section className="bg-[var(--nabus-background)] py-14 sm:py-16">
      <Container>
        <h2 className="text-xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-2xl">
          Why Nabus
        </h2>
        <p className="mt-1 text-sm text-[var(--nabus-text-secondary)]">
          Trusted automotive partner in Accra
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-[var(--nabus-charcoal)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--nabus-text-secondary)]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
