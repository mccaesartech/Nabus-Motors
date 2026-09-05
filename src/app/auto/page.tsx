import { SceneShowroomOpening } from "@/components/home/nabus/scene-showroom-opening";
import { SceneFindYourDrive } from "@/components/home/nabus/scene-find-your-drive";
import { SceneNabusSelect } from "@/components/home/nabus/scene-nabus-select";
import { SceneJustLanded } from "@/components/home/nabus/scene-just-landed";
import { SceneShopTheWay } from "@/components/home/nabus/scene-shop-the-way";
import { NabusOwnershipPack } from "@/components/nabus/nabus-ownership-pack";
import { SceneFinance } from "@/components/home/nabus/scene-finance";
import { SceneLatestDeal } from "@/components/home/nabus/scene-latest-deal";
import { SceneShowroomLocation } from "@/components/home/nabus/scene-showroom-location";
import { getSiteContent } from "@/lib/site-content";
import { fetchFeaturedVehicles, getLocallyAvailableVehicles } from "@/lib/supabase/vehicles";

export const metadata = {
  title: "Nabus Motors",
  description:
    "FIND YOUR NEXT DRIVE. Verified vehicles, seamless imports, flexible financing, and complete automotive services in Accra, Ghana.",
};

export const revalidate = 60;

export default async function AutoHomePage() {
  const [content, featured, local] = await Promise.all([
    getSiteContent(),
    fetchFeaturedVehicles(),
    getLocallyAvailableVehicles(),
  ]);

  const selectVehicles = featured.length >= 3 ? featured.slice(0, 3) : featured;
  const justLanded = local.length > 0 ? local.slice(0, 10) : featured.slice(0, 8);
  const latestDeal = featured[0];
  const heroVehicle = featured[0];

  return (
    <>
      <SceneShowroomOpening content={content.homepage} heroVehicle={heroVehicle} />
      <SceneFindYourDrive />
      {selectVehicles.length > 0 ? <SceneNabusSelect vehicles={selectVehicles} /> : null}
      <SceneJustLanded vehicles={justLanded} />
      <SceneShopTheWay />
      <NabusOwnershipPack />
      <SceneFinance />
      {latestDeal ? <SceneLatestDeal vehicle={latestDeal} /> : null}
      <SceneShowroomLocation />
    </>
  );
}
