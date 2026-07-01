import { Container } from "@/components/shared/container";
import { BackNav } from "@/components/shared/back-nav";
import { SectionHeader } from "@/components/shared/section-header";
import { PartsCartView } from "@/components/parts/parts-cart-view";
import { ROUTES } from "@/lib/routes";

export const metadata = {
  title: "Shopping cart",
  description:
    "Review vehicles and spare parts in your cart and request a quote from True Goshen.",
};

export default function CartPage() {
  return (
    <Container className="py-12 sm:py-16">
      <BackNav href={ROUTES.auto.inventory} label="Back to inventory" variant="public" />
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          title="Your cart"
          description="Review selected vehicles and parts, adjust quantities, and checkout."
          className="mt-6"
        />
        <div className="mt-8">
          <PartsCartView />
        </div>
      </div>
    </Container>
  );
}
