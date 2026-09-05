import { FoldOpening } from "@/components/fold/home/fold-opening";
import { FoldAsk } from "@/components/fold/home/fold-ask";
import { FoldPick } from "@/components/fold/home/fold-pick";
import { FoldRail } from "@/components/fold/home/fold-rail";
import { FoldWays } from "@/components/fold/home/fold-ways";
import { FoldOwnership } from "@/components/fold/home/fold-ownership";
import { FoldMoney } from "@/components/fold/home/fold-money";
import { FoldDeal } from "@/components/fold/home/fold-deal";
import { FoldPlace } from "@/components/fold/home/fold-place";
import { getSiteContent } from "@/lib/site-content";
import { fetchFeaturedVehicles, getLocallyAvailableVehicles } from "@/lib/supabase/vehicles";

export async function FoldHomePage() {
  const [content, featured, local] = await Promise.all([
    getSiteContent(),
    fetchFeaturedVehicles(),
    getLocallyAvailableVehicles(),
  ]);

  const pickVehicles = featured.length >= 3 ? featured.slice(0, 3) : featured;
  const justLanded = local.length > 0 ? local.slice(0, 10) : featured.slice(0, 8);
  const latestDeal = featured[0];
  const heroVehicle = featured[0];

  return (
    <>
      <FoldOpening content={content.homepage} heroVehicle={heroVehicle} />
      <FoldAsk />
      {pickVehicles.length > 0 ? <FoldPick vehicles={pickVehicles} /> : null}
      <FoldRail vehicles={justLanded} />
      <FoldWays />
      <FoldOwnership />
      <FoldMoney />
      {latestDeal ? <FoldDeal vehicle={latestDeal} /> : null}
      <FoldPlace />
    </>
  );
}
