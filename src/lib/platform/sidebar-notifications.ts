import { PLATFORM_NAV } from "@/lib/platform/nav";
import { platformPath } from "@/lib/platform/paths";
import type { AdminNotification } from "@/lib/platform/types";

const NAV_HREFS = new Set(PLATFORM_NAV.map((item) => item.href));

/** Map a notification to the sidebar nav href that should show its badge. */
export function navHrefForNotification(notification: AdminNotification): string | null {
  switch (notification.type) {
    case "team_message":
      return platformPath("team-chat");
    case "customer_message":
    case "support_ticket_reopened":
    case "support_ticket_claimed":
      return platformPath("messages");
    case "low_stock":
    case "vehicle_pending_approval":
    case "vehicle_stock_action":
      return platformPath("inventory");
    case "finance":
      return platformPath("finance");
    case "preorder":
    case "vehicle":
    case "contact":
    case "appraisal":
      return platformPath("leads");
    case "freight_quote":
      return platformPath("freight/quotes");
    default:
      break;
  }

  const link = notification.link;
  if (!link) return null;

  const match = PLATFORM_NAV.find(
    (item) => link === item.href || link.startsWith(`${item.href}/`) || link.startsWith(`${item.href}?`)
  );
  return match?.href ?? null;
}

export function countUnreadByNavHref(
  notifications: AdminNotification[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const notification of notifications) {
    if (notification.readAt) continue;
    const href = navHrefForNotification(notification);
    if (!href || !NAV_HREFS.has(href)) continue;
    counts[href] = (counts[href] ?? 0) + 1;
  }

  return counts;
}
