import { Hero } from "@/components/home/hero";
import { VehicleSearch } from "@/components/home/vehicle-search";
import { FeaturedVehicles } from "@/components/home/featured-vehicles";
import { WhyChooseUs } from "@/components/home/why-choose-us";
import { VehicleCategories } from "@/components/home/vehicle-categories";
import { Testimonials } from "@/components/home/testimonials";

export default function HomePage() {
  return (
    <>
      <Hero />
      <VehicleSearch />
      <FeaturedVehicles />
      <WhyChooseUs />
      <VehicleCategories />
      <Testimonials />
    </>
  );
}
