import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const IMPORT_STEPS = [
  { step: "1", title: "Tell us what you need", description: "Budget, make, model, and timeline." },
  { step: "2", title: "We source & verify", description: "Our team finds vehicles at origin." },
  { step: "3", title: "Reserve & ship", description: "Secure with deposit, track your shipment." },
  { step: "4", title: "Clear & deliver", description: "Customs, registration, and handover." },
];

export function NabusImportJourney() {
  return (
    <section className="bg-[var(--nabus-surface)] py-14 sm:py-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-2xl">
              Can&apos;t Find It? We&apos;ll Source It.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--nabus-text-secondary)] sm:text-base">
              Our import team handles sourcing, shipping, customs clearing, and delivery — with
              transparent updates at every milestone.
            </p>
            <Button
              className="mt-6 rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
              render={<Link href={ROUTES.auto.preorder} />}
            >
              Start Your Import
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {IMPORT_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-background)] p-5"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--nabus-primary)] text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-[var(--nabus-charcoal)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--nabus-text-secondary)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
