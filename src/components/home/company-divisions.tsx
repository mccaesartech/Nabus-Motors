import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { ServiceImageCardGrid } from "@/components/shared/service-image-card";
import type { CorporateDivisionsSiteContent } from "@/lib/site-content/corporate-defaults";

type CompanyDivisionsProps = {
  content: CorporateDivisionsSiteContent;
};

export function CompanyDivisions({ content }: CompanyDivisionsProps) {
  return (
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <Container>
        <SectionHeader
          title={content.title}
          description={content.description}
          align="center"
          className="mx-auto"
        />

        <ServiceImageCardGrid
          className="mt-10 max-w-none sm:grid-cols-2 lg:grid-cols-3"
          cards={content.cards.map((division) => ({
            id: division.id,
            title: division.title,
            subtitle: division.description,
            image: division.image,
            imageAlt: division.imageAlt,
            href: division.href || undefined,
          }))}
        />
      </Container>
    </section>
  );
}
