import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { FreightServiceCards } from "@/components/freight/freight-service-cards";
import { ShippingConsultationForm } from "@/components/freight/shipping-consultation-form";
import { getSiteContent } from "@/lib/site-content";

export const revalidate = 60;

export const metadata = {
  title: "Shipping Consultation",
  description:
    "Request a personalised shipping consultation from True Goshen — import routes, methods, timelines, and costs for vehicles and cargo to Ghana.",
};

export default async function ShippingConsultationPage() {
  const content = await getSiteContent();
  const page = content.shippingConsultation;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <SectionHeader title={page.heroTitle} description={page.heroSubtitle} />

        <div className="mb-10">
          <FreightServiceCards
            cards={page.cards.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.description,
              image: item.image,
              imageAlt: item.imageAlt,
              href: item.id === "advice" ? undefined : item.href || "#consultation-form",
            }))}
          />
        </div>

        <div id="consultation-form" className="scroll-mt-[var(--header-height)]">
          <ShippingConsultationForm />
        </div>
      </div>
    </Container>
  );
}
