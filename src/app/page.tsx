import { NabusHero } from "@/components/home/nabus/nabus-hero";
import { NabusQuickActionDock } from "@/components/home/nabus/nabus-quick-action-dock";
import { NabusFeaturedCarousel } from "@/components/home/nabus/nabus-featured-carousel";
import { NabusAdvantageBand } from "@/components/home/nabus/nabus-advantage-band";
import { NabusImportJourney } from "@/components/home/nabus/nabus-import-journey";
import { NabusFinancingSection } from "@/components/home/nabus/nabus-financing-section";
import { NabusServicesAlternating } from "@/components/home/nabus/nabus-services-alternating";
import { NabusFinalCta } from "@/components/home/nabus/nabus-final-cta";
import { getSiteContent } from "@/lib/site-content";
import { fetchFeaturedVehicles } from "@/lib/supabase/vehicles";

export const revalidate = 120;

export const metadata = {
  title: "Nabus Motors and Trading",
  description:
    "Nabus Motors and Trading — vehicle imports, sales, rentals, financing, and full automotive services in Ghana.",
};

export default async function CorporateHomePage() {
  const [content, featured] = await Promise.all([
    getSiteContent(),
    fetchFeaturedVehicles(),
  ]);

  return (
    <>
      <NabusHero content={content.homepage} />
      <NabusQuickActionDock />
      <NabusFeaturedCarousel vehicles={featured.slice(0, 4)} />
      <NabusImportJourney />
      <NabusAdvantageBand />
      <NabusFinancingSection />
      <NabusServicesAlternating />
      <NabusFinalCta />
    </>
  );
}
