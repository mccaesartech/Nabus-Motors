import Link from "next/link";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { Button } from "@/components/ui/button";
import { vehicleImages } from "@/lib/data/vehicles";
import { Shield, Users, Award, Handshake } from "lucide-react";

export const metadata = {
  title: "About Us",
  description:
    "Learn about True Goshen Auto — our mission, quality standards, and commitment to customer trust.",
};

const values = [
  {
    icon: Shield,
    title: "Trust & Transparency",
    description:
      "Every vehicle listing includes verified history, documented inspections, and clear pricing with no hidden fees.",
  },
  {
    icon: Award,
    title: "Quality Standards",
    description:
      "Our 150-point inspection process ensures every vehicle meets rigorous mechanical and safety standards before listing.",
  },
  {
    icon: Users,
    title: "Customer Commitment",
    description:
      "Dedicated advisors guide you from first inquiry through delivery and follow-up, with no high-pressure sales tactics.",
  },
  {
    icon: Handshake,
    title: "Community Focus",
    description:
      "Based in Accra, Ghana, we serve customers across the country with the same level of care and professionalism.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative bg-brand-black py-20 sm:py-24">
        <Container>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-gold">
            About True Goshen Auto
          </p>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold text-white sm:text-4xl">
            Built on Trust, Driven by Quality
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            True Goshen Auto was founded with a simple belief: buying a vehicle
            should feel safe, transparent, and professional. We combine rigorous
            inspection standards with honest communication to earn your confidence.
          </p>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden">
              <SafeVehicleImage
                src={vehicleImages.showroom}
                alt="True Goshen Auto showroom"
              />
            </div>
            <div>
              <SectionHeader
                title="Our Mission"
                description="To provide a safe, reliable marketplace where every customer can purchase a quality vehicle with complete confidence in the process and the product."
                className="mb-0"
              />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                We understand that a vehicle purchase is one of the most significant
                financial decisions most people make. That is why we invest in thorough
                inspections, verified vehicle histories, and a team that prioritizes
                your interests over quick sales.
              </p>
              <Button className="mt-6" render={<Link href="/inventory" />}>
                View Our Inventory
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-border bg-brand-cream py-14 sm:py-16">
        <Container>
          <SectionHeader
            title="What We Stand For"
            align="center"
            className="mx-auto"
          />
          <div className="grid gap-8 sm:grid-cols-2">
            {values.map((value) => (
              <div key={value.title} className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-brand-charcoal shadow-luxury">
                  <value.icon className="size-5 text-brand-purple" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <SectionHeader
                title="Vehicle Quality Standards"
                description="Every vehicle in our inventory passes a comprehensive evaluation."
                className="mb-0"
              />
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>150-point mechanical and cosmetic inspection</li>
                <li>Title and ownership verification</li>
                <li>Odometer and VIN validation</li>
                <li>Complete service history review when available</li>
                <li>Road test and diagnostic scan</li>
                <li>Professional detailing before delivery</li>
              </ul>
            </div>
            <div className="relative order-1 aspect-[4/3] overflow-hidden lg:order-2">
              <SafeVehicleImage
                src={vehicleImages.workshop}
                alt="Vehicle inspection process"
              />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
