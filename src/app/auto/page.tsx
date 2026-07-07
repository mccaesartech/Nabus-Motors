import { Suspense } from "react";
import { Hero } from "@/components/home/hero";
import { AutoQuickNav } from "@/components/home/auto-quick-nav";
import { CompanyDivisions } from "@/components/home/company-divisions";
import { VehicleSearch } from "@/components/home/vehicle-search";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import { FeaturedVehicles } from "@/components/home/featured-vehicles";
import { FeaturedVehiclesSkeleton } from "@/components/home/featured-vehicles-skeleton";
import { RecommendedVehiclesSection } from "@/components/recommendations/recommended-vehicles-section";
import { WhyBuyFromTrueGoshen } from "@/components/home/why-buy-from-true-goshen";
import { WhyChooseUs } from "@/components/home/why-choose-us";
import { VehicleCategories } from "@/components/home/vehicle-categories";
import { Testimonials } from "@/components/home/testimonials";
import { DeferredSection } from "@/components/shared/deferred-section";
import { getSiteContent } from "@/lib/site-content";

export const metadata = {
  title: "True Goshen Auto",
  description:
    "Browse verified vehicles with transparent pricing, flexible financing, and trusted customer support. True Goshen Auto — Drive With Confidence.",
};

export const revalidate = 60;

export default async function AutoHomePage() {
  const content = await getSiteContent();

  return (
    <>
      <Hero content={content.homepage} />
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
