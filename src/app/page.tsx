import { CorporateAbout, CorporateContactCta, CorporateFaq, CorporateHero, CorporateServices, CorporateStats } from "@/components/corporate/corporate-sections";
import { StartYourJourney } from "@/components/home/start-your-journey";
import { Testimonials } from "@/components/home/testimonials";
import { WhyChooseUs } from "@/components/home/why-choose-us";
import { WhyBuyFromTrueGoshen } from "@/components/home/why-buy-from-true-goshen";
import { DeferredSection } from "@/components/shared/deferred-section";
import { getSiteContent } from "@/lib/site-content";

export const revalidate = 120;

export const metadata = {
  title: "True Goshen Company Limited",
  description:
    "True Goshen Company Limited — vehicle imports, freight forwarding, customs clearing, and genuine spare parts for Ghana and beyond.",
};

export default async function CorporateHomePage() {
  const content = await getSiteContent();

  return (
    <>
      <CorporateHero content={content.corporateHomepage} />
      <StartYourJourney />
      <CorporateAbout content={content.corporateHomepage} />
      <CorporateServices content={content.corporateServices} />
      <WhyBuyFromTrueGoshen variant="compact" />
      <WhyChooseUs content={content.whyChooseUs} />
      <DeferredSection fallback={<div className="min-h-[12rem] border-b border-border bg-brand-black" aria-hidden />}>
        <CorporateStats content={content.corporateStats} />
      </DeferredSection>
      <DeferredSection fallback={<div className="min-h-[16rem] border-t border-border bg-background" aria-hidden />}>
        <Testimonials content={content.corporateTestimonials} />
      </DeferredSection>
      <DeferredSection fallback={<div className="min-h-[16rem] border-b border-border bg-background" aria-hidden />}>
        <CorporateFaq content={content.corporateFaq} />
      </DeferredSection>
      <CorporateContactCta content={content.corporateHomepage} />
    </>
  );
}
