import dynamic from "next/dynamic";
import { CorporateAbout, CorporateContactCta, CorporateFaq, CorporateHero, CorporateServices, CorporateStats } from "@/components/corporate/corporate-sections";
import { LocallyAvailableCarsBanner } from "@/components/vehicle/locally-available-cars-banner";
import { Testimonials } from "@/components/home/testimonials";
import { WhyChooseUs } from "@/components/home/why-choose-us";
import { WhyBuyFromNabus } from "@/components/home/why-buy-from-nabus";
import { DeferredSection } from "@/components/shared/deferred-section";
import { getSiteContent } from "@/lib/site-content";
import { getLocallyAvailableVehicles } from "@/lib/supabase/vehicles";

const StartYourJourney = dynamic(
  () =>
    import("@/components/home/start-your-journey").then((m) => ({
      default: m.StartYourJourney,
    })),
  { loading: () => <div className="min-h-[14rem] border-b border-border bg-background" aria-hidden /> }
);

export const revalidate = 120;

export const metadata = {
  title: "Nabus Motors and Trading",
  description:
    "Nabus Motors and Trading — vehicle imports, freight forwarding, customs clearing, and genuine spare parts for Ghana and beyond.",
};

export default async function CorporateHomePage() {
  const [content, localVehicles] = await Promise.all([
    getSiteContent(),
    getLocallyAvailableVehicles(),
  ]);

  return (
    <>
      <CorporateHero content={content.corporateHomepage} />
      <StartYourJourney content={content.startYourJourney} />
      <LocallyAvailableCarsBanner vehicles={localVehicles} />
      <CorporateAbout content={content.corporateHomepage} />
      <CorporateServices content={content.corporateServices} />
      <WhyBuyFromNabus variant="compact" />
      <WhyChooseUs content={content.whyChooseUs} />
      <DeferredSection fallback={<div className="min-h-[12rem] border-b border-border bg-brand-primary" aria-hidden />}>
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
