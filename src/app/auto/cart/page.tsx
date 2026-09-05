import { Container } from "@/components/shared/container";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { PartsCartView } from "@/components/parts/parts-cart-view";

export const metadata = {
  title: "Reserve",
  description: "Complete your vehicle reservation at Nabus Motors.",
};

export default function CartPage() {
  return (
    <div className="bg-[var(--nabus-ivory)] py-10 sm:py-14">
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center justify-between border-b border-[var(--nabus-border)] pb-6">
            <div>
              <NabusSectionLabel showArc={false}>Secure Checkout</NabusSectionLabel>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
                Reserve This Car
              </h1>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--nabus-muted)]">
              Encrypted
            </span>
          </div>
          <PartsCartView />
        </div>
      </Container>
    </div>
  );
}
