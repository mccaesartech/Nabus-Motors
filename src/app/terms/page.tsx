import { Container } from "@/components/shared/container";

export const metadata = {
  title: "Terms & Conditions",
};

export default function TermsPage() {
  return (
    <Container className="py-14 sm:py-16">
      <h1 className="text-2xl font-semibold">Terms & Conditions</h1>
      <div className="prose prose-sm mt-8 max-w-3xl text-muted-foreground">
        <p>
          By accessing and using the Nabus Motors website, you agree to these
          terms and conditions. Please read them carefully before using our
          services.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">
          Vehicle Listings
        </h2>
        <p>
          All vehicle listings are subject to prior sale. Prices, specifications,
          and availability are subject to change without notice. We make every
          effort to ensure accuracy but recommend verifying details before
          purchase.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">
          Financing
        </h2>
        <p>
          Financing terms are subject to credit approval. Advertised rates and
          payment estimates are for illustrative purposes and may vary based on
          individual credit profiles and lender requirements.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">
          Limitation of Liability
        </h2>
        <p>
          Nabus Motors shall not be liable for any indirect, incidental, or
          consequential damages arising from the use of this website or purchase
          of vehicles through our platform.
        </p>
      </div>
    </Container>
  );
}
