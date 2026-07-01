import { revalidatePath, revalidateTag } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { SITE_CONTENT_CACHE_TAG } from "@/lib/site-content";
import { PUBLIC_VEHICLES_CACHE_TAG } from "@/lib/supabase/vehicles";

/** Bust cached public pages after admin inventory changes. */
export function revalidatePublicSite(slug?: string) {
  revalidateTag(PUBLIC_VEHICLES_CACHE_TAG, "max");
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
  revalidateTag(SITE_CONTENT_CACHE_TAG, "max");
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
