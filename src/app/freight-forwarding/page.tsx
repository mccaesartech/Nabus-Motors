import { FreightQuoteForm } from "@/components/freight/freight-quote-form";
import { NabusEditorialPageHero } from "@/components/nabus/nabus-editorial-page-hero";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
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
    <div className="bg-[var(--nabus-ivory)]">
      <NabusEditorialPageHero title={page.heroTitle} description={page.heroSubtitle} label="Freight & Clearing" />

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
          <NabusSectionLabel>Services</NabusSectionLabel>
          <div className="mt-10 grid gap-px bg-[var(--nabus-border)] sm:grid-cols-2">
            {page.cards.map((service) => {
              const serviceType = FREIGHT_CARD_SERVICE[service.id];
              const scrollHref = serviceType
                ? `?service=${serviceType}#request-quote`
                : "#request-quote";

              return (
                <a
                  key={service.id}
                  href={service.href || scrollHref}
                  className="group block bg-[var(--nabus-paper)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-[var(--nabus-border)]">
                    <SafeVehicleImage
                      src={service.image}
                      alt={service.imageAlt || service.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-[var(--nabus-graphite)]">{service.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--nabus-muted)]">
                      {service.description}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>

          <div
            id="request-quote"
            className="mt-14 scroll-mt-[var(--header-height)] border border-[var(--nabus-border)] bg-[var(--nabus-paper)] p-6 sm:p-8"
          >
            <NabusSectionLabel>Request Quote</NabusSectionLabel>
            <h2 className="mt-4 text-xl font-semibold text-[var(--nabus-graphite)]">
              Request a freight quote
            </h2>
            <p className="mt-2 text-sm text-[var(--nabus-muted)]">
              Tell us about your shipment and our freight team will respond with options and pricing.
            </p>
            <div className="mt-6">
              <FreightQuoteForm initialServiceType={initialService || undefined} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
