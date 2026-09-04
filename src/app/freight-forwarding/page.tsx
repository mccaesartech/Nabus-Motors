import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { ServiceImageCardGrid } from "@/components/shared/service-image-card";
import { FreightQuoteForm } from "@/components/freight/freight-quote-form";
import { getSiteContent } from "@/lib/site-content";

export const revalidate = 60;

export const metadata = {
  title: "Freight Forwarding & Clearing",
  description:
    "Vehicle shipping, container logistics, documentation, and Ghana customs clearing by Nabus Motors and Trading.",
};

const FREIGHT_CARD_SERVICE: Record<string, string> = {
  "vehicle-shipping": "vehicle_shipping",
  container: "container_shipping",
  documentation: "documentation",
  clearing: "clearing",
};

type PageProps = {
  searchParams: Promise<{ service?: string }>;
};

export default async function FreightForwardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const content = await getSiteContent();
  const page = content.freightLanding;
  const initialService = params.service ?? "";

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <SectionHeader title={page.heroTitle} description={page.heroSubtitle} />

        <ServiceImageCardGrid
          cards={page.cards.map((service) => {
            const serviceType = FREIGHT_CARD_SERVICE[service.id];
            const scrollHref = serviceType
              ? `?service=${serviceType}#request-quote`
              : "#request-quote";

            return {
              id: service.id,
              title: service.title,
              subtitle: service.description,
              image: service.image,
              imageAlt: service.imageAlt,
              href: service.href || scrollHref,
            };
          })}
        />

        <div
          id="request-quote"
          className="mt-12 scroll-mt-[var(--header-height)] rounded-xl border border-border bg-card p-6 shadow-luxury sm:p-8"
        >
          <h2 className="text-lg font-semibold">Request a freight quote</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us about your shipment and our freight team will respond with options and pricing.
          </p>
          <div className="mt-6">
            <FreightQuoteForm initialServiceType={initialService || undefined} />
          </div>
        </div>
      </div>
    </Container>
  );
}
