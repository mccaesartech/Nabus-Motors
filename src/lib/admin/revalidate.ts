import { revalidatePath, revalidateTag } from "next/cache";
import { ROUTES } from "@/lib/routes";

/** Must match PUBLIC_VEHICLES_CACHE_TAG in @/lib/supabase/vehicles */
const PUBLIC_VEHICLES_CACHE_TAG = "public-vehicles";
/** Must match SITE_CONTENT_CACHE_TAG in @/lib/site-content */
const SITE_CONTENT_CACHE_TAG = "site-content";

/** Bust cached public pages after admin inventory changes. */
export function revalidatePublicSite(slug?: string) {
  // expire: 0 drops tagged caches immediately so trashed vehicles are not SWR-served.
  revalidateTag(PUBLIC_VEHICLES_CACHE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath(ROUTES.auto.home);
  revalidatePath(ROUTES.auto.inventory);
  revalidatePath(ROUTES.auto.inventory, "layout");
  revalidatePath(ROUTES.auto.inventory, "page");
  revalidatePath("/auto/inventory/[slug]", "page");
  if (slug) {
    revalidatePath(ROUTES.auto.inventoryDetail(slug));
  }
}

/** Bust public pages after site content CMS changes. */
export function revalidateSiteContent() {
  revalidateTag(SITE_CONTENT_CACHE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/services");
  revalidatePath("/freight-forwarding");
  revalidatePath("/shipping-consultation");
  revalidatePath(ROUTES.auto.home);
  revalidatePath(ROUTES.auto.spareParts);
  revalidatePath(ROUTES.auto.buy);
  revalidatePath(ROUTES.auto.sell);
  revalidatePath(ROUTES.auto.financing);
  revalidatePath("/api/site-content");
}
