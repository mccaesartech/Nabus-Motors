import { Container } from "@/components/shared/container";
import { Award } from "lucide-react";

export function NabusAwardSection() {
  return (
    <section className="border-y border-[var(--nabus-border)] bg-[var(--nabus-background)] py-14 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--nabus-yellow-soft)] text-[var(--nabus-charcoal)]">
            <Award className="size-8" strokeWidth={1.5} />
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[var(--nabus-primary)]">
            Recognised Excellence
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-4xl">
            Best Automobile Dealer of the Year
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--nabus-text-secondary)] sm:text-base">
            Nabus Motors and Trading is proud to be recognised as Ghana&apos;s leading automobile
            dealership — a testament to our commitment to quality vehicles, transparent service, and
            customer satisfaction.
          </p>
        </div>
      </Container>
    </section>
  );
}
