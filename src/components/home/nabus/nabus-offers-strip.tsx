import Link from "next/link";
import { Container } from "@/components/shared/container";
import { ROUTES } from "@/lib/routes";
import { ArrowRight } from "lucide-react";

const OFFERS = [
  {
    label: "25% Down Pre-Orders",
    href: ROUTES.auto.preorder,
  },
  {
    label: "In-Ghana Ready Stock",
    href: ROUTES.auto.availableLocally,
  },
  {
    label: "Trade-In Appraisals",
    href: ROUTES.auto.sell,
  },
  {
    label: "Free Shipping Consultation",
    href: ROUTES.corporate.shippingConsultation,
  },
];

export function NabusOffersStrip() {
  return (
    <section className="border-y border-[var(--nabus-border)] bg-[var(--nabus-red-soft)] py-4">
      <Container>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {OFFERS.map((offer) => (
            <Link
              key={offer.href}
              href={offer.href}
              className="group inline-flex items-center gap-2 text-sm font-bold text-[var(--nabus-primary)] transition-colors hover:text-[var(--nabus-primary-hover)]"
            >
              {offer.label}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
