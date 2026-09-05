import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { NabusEditorialPageHero } from "@/components/nabus/nabus-editorial-page-hero";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
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
    <div className="bg-[var(--nabus-ivory)]">
      <NabusEditorialPageHero
        label={page.heroEyebrow.trim() || "What We Do"}
        title={page.heroTitle}
        description={page.heroSubtitle}
      />

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
          <NabusSectionLabel>Our Divisions</NabusSectionLabel>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--nabus-muted)]">
            Each division is built for a distinct need — browse the one that fits your drive.
          </p>

          <div className="mt-10 space-y-px bg-[var(--nabus-border)]">
            {page.cards.map((service, index) => (
              <article
                key={service.id}
                className="grid bg-[var(--nabus-paper)] lg:grid-cols-12 lg:gap-8"
              >
                <div
                  className={`relative aspect-[16/10] overflow-hidden border-b border-[var(--nabus-border)] lg:col-span-5 lg:border-b-0 lg:border-r ${
                    index % 2 === 1 ? "lg:order-2 lg:border-r-0 lg:border-l" : ""
                  }`}
                >
                  <SafeVehicleImage
                    src={service.image}
                    alt={service.imageAlt || service.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div
                  className={`flex flex-col justify-center p-6 sm:p-8 lg:col-span-7 lg:p-10 ${
                    index % 2 === 1 ? "lg:order-1" : ""
                  }`}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--nabus-muted)]">
                    Division {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--nabus-graphite)] sm:text-2xl">
                    {service.title}
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--nabus-muted)]">
                    {service.description}
                  </p>
                  {service.href && service.cta ? (
                    <Link
                      href={service.href}
                      className="mt-6 inline-flex w-fit items-center gap-2 border-b border-[var(--nabus-wine)] pb-1 text-sm font-semibold text-[var(--nabus-wine)] transition-colors hover:text-[var(--nabus-crimson)]"
                    >
                      {service.cta}
                      <ArrowUpRight className="size-4" />
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
