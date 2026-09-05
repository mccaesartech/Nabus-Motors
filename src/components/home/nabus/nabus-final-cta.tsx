import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { whatsappUrl } from "@/lib/constants";

export function NabusFinalCta() {
  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div className="rounded-xl bg-[var(--nabus-nav-dark)] px-6 py-12 text-center sm:px-12 sm:py-14">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Ready to find your next vehicle?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-white/75 sm:text-base">
            Browse inventory, start an import, or speak with an advisor — we&apos;re here to help.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
              render={<Link href={ROUTES.auto.inventory} />}
            >
              Explore Cars
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-lg border-white/30 bg-transparent text-white hover:bg-white/10"
              render={
                <a
                  href={whatsappUrl("Hello Nabus Motors, I'd like to speak with an advisor.")}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Chat on WhatsApp
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
