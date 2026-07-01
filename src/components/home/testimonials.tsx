import { BadgeCheck, Star } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import type { TestimonialsSiteContent } from "@/lib/site-content/defaults";
import { resolveTestimonialImage } from "@/lib/site-content/media-url";

type TestimonialsProps = {
  content: TestimonialsSiteContent;
};

export function Testimonials({ content }: TestimonialsProps) {
  return (
    <section className="border-t border-border bg-background py-16 sm:py-20">
      <Container>
        <SectionHeader
          title={content.title}
          description={content.description}
          align="center"
          className="mx-auto"
        />

        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {content.items.map((testimonial, index) => (
            <article
              key={testimonial.id}
              className="border border-border bg-card p-6 shadow-luxury"
            >
              <div className="flex items-start gap-4">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                  <SafeVehicleImage
                    src={resolveTestimonialImage(testimonial.image, index)}
                    alt={testimonial.name}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{testimonial.name}</h3>
                    {testimonial.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-purple">
                        <BadgeCheck className="size-3.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.location} · {testimonial.vehicle}
                  </p>
                  <div className="mt-1 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={
                          i < testimonial.rating
                            ? "size-3 fill-brand-cta-gold text-brand-cta-gold"
                            : "size-3 fill-brand-cta-gold/20 text-brand-cta-gold/20"
                        }
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
