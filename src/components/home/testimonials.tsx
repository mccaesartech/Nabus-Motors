import { BadgeCheck, Star } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { testimonials } from "@/lib/data/vehicles";

export function Testimonials() {
  return (
    <section className="border-t border-border bg-white py-16 sm:py-20">
      <Container>
        <SectionHeader
          title="Customer Testimonials"
          description="Feedback from customers who purchased through True Goshen Auto."
          align="center"
          className="mx-auto"
        />

        <div className="grid gap-6 sm:grid-cols-2">
          {testimonials.map((testimonial) => (
            <article
              key={testimonial.id}
              className="border border-border bg-brand-cream/50 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                  <SafeVehicleImage
                    src={testimonial.image}
                    alt={testimonial.name}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{testimonial.name}</h3>
                    {testimonial.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-gold">
                        <BadgeCheck className="size-3.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.location} · {testimonial.vehicle}
                  </p>
                  <div className="mt-1 flex gap-0.5">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-3 fill-brand-gold text-brand-gold"
                      />
                    ))}
                  </div>
                </div>
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
