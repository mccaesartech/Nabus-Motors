import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Hero } from "@/components/home/hero";
import { AutoQuickNav } from "@/components/home/auto-quick-nav";
import { LocallyAvailableCarsBanner } from "@/components/vehicle/locally-available-cars-banner";
import { CompanyDivisions } from "@/components/home/company-divisions";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import { FeaturedVehicles } from "@/components/home/featured-vehicles";
import { FeaturedVehiclesSkeleton } from "@/components/home/featured-vehicles-skeleton";
import { WhyBuyFromTrueGoshen } from "@/components/home/why-buy-from-true-goshen";
import { WhyChooseUs } from "@/components/home/why-choose-us";
import { VehicleCategories } from "@/components/home/vehicle-categories";
import { Testimonials } from "@/components/home/testimonials";
import { DeferredSection } from "@/components/shared/deferred-section";
import { getSiteContent } from "@/lib/site-content";
import { getLocallyAvailableVehicles } from "@/lib/supabase/vehicles";

const VehicleSearch = dynamic(
  () =>
    import("@/components/home/vehicle-search").then((m) => ({
      default: m.VehicleSearch,
    })),
  { loading: () => <div className="min-h-[12rem] border-b border-border bg-muted/20" aria-hidden /> }
);

const RecommendedVehiclesSection = dynamic(
  () =>
    import("@/components/recommendations/recommended-vehicles-section").then(
      (m) => ({ default: m.RecommendedVehiclesSection })
    ),
  { loading: () => null }
);

export const metadata = {
  title: "True Goshen Auto",
  description:
    "Browse verified vehicles with transparent pricing, flexible financing, and trusted customer support. True Goshen Auto — Drive With Confidence.",
};

export const revalidate = 60;

export default async function AutoHomePage() {
  const [content, localVehicles] = await Promise.all([
    getSiteContent(),
    getLocallyAvailableVehicles(),
  ]);

  return (
    <>
      <Hero content={content.homepage} />
      <LocallyAvailableCarsBanner variant="compact" vehicles={localVehicles} />
      <AutoQuickNav />
      <CompanyDivisions content={content.corporateDivisions} />
      <VehicleSearch />
      <div className="border-b border-border bg-muted/20 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <CustomVehicleRequestCta variant="banner" />
        </div>
      </div>
      <Suspense fallback={<FeaturedVehiclesSkeleton />}>
        <FeaturedVehicles />
      </Suspense>
      <RecommendedVehiclesSection />
      <WhyBuyFromTrueGoshen />
      <WhyChooseUs content={content.whyChooseUs} />
      <VehicleCategories content={content.browseByCategory} />
      <DeferredSection fallback={<div className="min-h-[16rem] border-t border-border bg-background" aria-hidden />}>
        <Testimonials content={content.testimonials} />
      </DeferredSection>
    </>
  );
}
