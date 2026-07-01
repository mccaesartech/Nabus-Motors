import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { resolveSiteContentIcon } from "@/lib/site-content-icons";
import type { WhyChooseUsSiteContent } from "@/lib/site-content/defaults";

type WhyChooseUsProps = {
  content: WhyChooseUsSiteContent;
};

export function WhyChooseUs({ content }: WhyChooseUsProps) {
  return (
    <section className="border-y border-border bg-section-warm py-20 sm:py-24">
      <Container>
        <SectionHeader
          title={content.title}
          description={content.description}
          align="center"
          className="mx-auto"
        />

        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {content.cards.map((feature) => {
            const Icon = resolveSiteContentIcon(feature.icon);
            return (
              <article
                key={feature.title}
                className="group rounded-xl border border-border/70 bg-card p-6 shadow-luxury transition-shadow duration-300 hover:shadow-luxury-lg"
              >
                <div className="flex size-12 items-center justify-center rounded-lg border border-icon-box-border bg-icon-box-bg shadow-sm ring-1 ring-icon-box-border/40">
                  <Icon className="size-6 text-icon-box-fg" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
