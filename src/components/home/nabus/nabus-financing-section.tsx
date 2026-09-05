import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export function NabusFinancingSection() {
  return (
    <section className="bg-[var(--nabus-yellow-soft)] py-14 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-2xl">
            Flexible Financing
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--nabus-text-secondary)] sm:text-base">
            Partner rates through Autochek and trusted lenders. Pre-qualify without affecting your
            credit score.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
              render={<Link href={ROUTES.auto.financing} />}
            >
              Explore Financing
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-lg border-[var(--nabus-input-border)] bg-[var(--nabus-surface)]"
              render={<Link href={`${ROUTES.auto.financing}#calculator`} />}
            >
              Payment Calculator
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
