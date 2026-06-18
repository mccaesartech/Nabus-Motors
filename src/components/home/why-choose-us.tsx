import {
  BadgeCheck,
  Calculator,
  Headphones,
  SearchCheck,
  Truck,
} from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";

const features = [
  {
    icon: BadgeCheck,
    title: "Verified Vehicles",
    description:
      "Every vehicle undergoes identity verification, title checks, and odometer validation before listing.",
  },
  {
    icon: SearchCheck,
    title: "Thorough Inspections",
    description:
      "Our 150-point inspection covers mechanical, structural, and cosmetic condition with documented results.",
  },
  {
    icon: Calculator,
    title: "Flexible Financing",
    description:
      "Competitive rates with multiple lender options. Pre-qualification available without impacting your credit score.",
  },
  {
    icon: Truck,
    title: "Nationwide Delivery",
    description:
      "Professional transport to your location with full insurance coverage and delivery tracking.",
  },
  {
    icon: Headphones,
    title: "Customer Support",
    description:
      "Dedicated advisors available throughout your purchase, from initial inquiry through post-delivery follow-up.",
  },
];

export function WhyChooseUs() {
  return (
    <section className="border-y border-border bg-brand-cream py-20 sm:py-24">
      <Container>
        <SectionHeader
          title="Why Choose True Goshen"
          description="We built our process around transparency and accountability — the qualities that matter when purchasing a vehicle."
          align="center"
          className="mx-auto"
        />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-brand-charcoal text-brand-gold shadow-luxury">
                <feature.icon className="size-5 text-brand-purple" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
