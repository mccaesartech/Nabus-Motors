import Link from "next/link";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { ServiceImageCard } from "@/components/shared/service-image-card";
import { Button } from "@/components/ui/button";
import { getSiteContent } from "@/lib/site-content";

export const revalidate = 60;

export const metadata = {
  title: "Services",
  description:
    "Explore Nabus Motors and Trading services — vehicles, freight forwarding, spare parts, and shipping consultation.",
};

export default async function ServicesPage() {
  const content = await getSiteContent();
  const page = content.corporateServicesPage;

  return (
    <>
      <section className="bg-brand-primary py-16 sm:py-20">
        <Container>
          {page.heroEyebrow.trim() && (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
              {page.heroEyebrow}
            </p>
          )}
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold text-white sm:text-4xl">
            {page.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-on-dark-secondary">
            {page.heroSubtitle}
          </p>
        </Container>
      </section>

      <section className="border-b border-border bg-muted py-14 sm:py-16">
        <Container>
          <SectionHeader
            title="Our Divisions"
            description="Tap a division to explore services, inventory, and support."
            align="center"
            className="mx-auto"
          />
          <div className="mx-auto grid max-w-[26cm] grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 sm:gap-5">
            {page.cards.map((service) => (
              <div key={service.id} className="flex w-[min(100%,12cm)] flex-col items-center gap-4">
                <ServiceImageCard
                  id={service.id}
                  title={service.title}
                  subtitle={service.description}
                  image={service.image}
                  imageAlt={service.imageAlt}
                  href={service.href || undefined}
                />
                {service.href && service.cta && (
                  <Button className="w-full sm:w-auto" render={<Link href={service.href} />}>
                    {service.cta}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
