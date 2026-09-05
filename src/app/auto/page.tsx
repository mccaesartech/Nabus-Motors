import { NabusHero } from "@/components/home/nabus/nabus-hero";
import { NabusQuickActionDock } from "@/components/home/nabus/nabus-quick-action-dock";
import { NabusFeaturedCarousel } from "@/components/home/nabus/nabus-featured-carousel";
import { NabusShopByNeed } from "@/components/home/nabus/nabus-shop-by-need";
import { NabusAdvantageBand } from "@/components/home/nabus/nabus-advantage-band";
import { NabusImportJourney } from "@/components/home/nabus/nabus-import-journey";
import { NabusFinancingSection } from "@/components/home/nabus/nabus-financing-section";
import { NabusOffersStrip } from "@/components/home/nabus/nabus-offers-strip";
import { NabusServicesAlternating } from "@/components/home/nabus/nabus-services-alternating";
import { NabusAwardSection } from "@/components/home/nabus/nabus-award-section";
import { NabusFinalCta } from "@/components/home/nabus/nabus-final-cta";
import { getSiteContent } from "@/lib/site-content";
import { fetchFeaturedVehicles } from "@/lib/supabase/vehicles";

export const metadata = {
  title: "Nabus Motors",
  description:
    "Dream it. Drive it. Live it. Verified vehicles, seamless imports, flexible financing, and complete automotive services in Accra, Ghana.",
};

export const revalidate = 60;

export default async function AutoHomePage() {
  const [content, featured] = await Promise.all([
    getSiteContent(),
    fetchFeaturedVehicles(),
  ]);

  return (
    <>
      <NabusHero content={content.homepage} />
      <NabusQuickActionDock />
      <NabusFeaturedCarousel vehicles={featured.slice(0, 8)} />
      <NabusShopByNeed />
      <NabusAdvantageBand />
      <NabusImportJourney />
      <NabusFinancingSection />
      <NabusOffersStrip />
      <NabusServicesAlternating />
      <NabusAwardSection />
      <NabusFinalCta />
    </>
  );
}
