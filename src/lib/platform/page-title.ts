import { PLATFORM_NAV } from "@/lib/platform/nav";
import { platformPath } from "@/lib/platform/paths";

/** Resolve the mobile/desktop topbar title for a platform route. */
export function platformPageTitle(pathname: string): string {
  if (pathname.startsWith(platformPath("notifications"))) return "Notifications";
  if (pathname.startsWith(platformPath("emails"))) return "Emails";
  if (pathname.startsWith(platformPath("search"))) return "Search";
  if (pathname.includes("/inventory/new")) return "Add vehicle";
  if (pathname.includes("/inventory/") && pathname.endsWith("/edit")) return "Edit vehicle";
  if (pathname.endsWith("/users/activity")) return "Activity";
  if (pathname.includes("/leads/preorder/")) return "Pre-order detail";
  if (/^\/platform\/customers\/[^/]+$/.test(pathname)) return "Customer detail";
  if (pathname.startsWith(platformPath("invite"))) return "Team invite";
  if (pathname.startsWith(platformPath("appointments"))) return "Appointments";
  if (pathname.startsWith(platformPath("tracking"))) return "Import Tracking";
  if (pathname.startsWith(platformPath("freight/orders"))) return "Freight Orders";
  if (pathname.startsWith(platformPath("freight/quotes"))) return "Quote Requests";
  if (pathname.startsWith(platformPath("freight/tracking"))) return "Freight Tracking";
  if (pathname.startsWith(platformPath("freight/documents"))) return "Freight Documents";
  if (pathname.startsWith(platformPath("parts/categories"))) return "Parts Categories";
  if (pathname.startsWith(platformPath("parts/inventory"))) return "Parts Inventory";
  if (pathname.startsWith(platformPath("parts/published"))) return "Draft & Published";

  const match = PLATFORM_NAV.find((item) => {
    if (item.href.endsWith("/dashboard")) {
      return (
        pathname === item.href ||
        pathname === "/platform" ||
        pathname === platformPath("")
      );
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  return match?.label ?? "Platform";
}
