import { ROUTES } from "@/lib/routes";

export type NabusNavLink = {
  href: string;
  label: string;
};

export type NabusNavItem =
  | (NabusNavLink & { children?: never })
  | {
      label: string;
      href?: string;
      children: NabusNavLink[];
    };

/** Primary public navigation — Nabus Motors. */
export const NABUS_PRIMARY_NAV: NabusNavItem[] = [
  { href: ROUTES.auto.inventory, label: "Cars" },
  { href: ROUTES.auto.preorder, label: "Import" },
  { href: ROUTES.auto.sell, label: "Sell/Swap" },
  { href: ROUTES.auto.rentals, label: "Rentals" },
  {
    label: "Services",
    children: [
      { href: `${ROUTES.corporate.services}#insurance`, label: "Insurance" },
      { href: `${ROUTES.corporate.services}#registration`, label: "Registration" },
      { href: `${ROUTES.corporate.services}#roadworthy`, label: "Roadworthy" },
      { href: `${ROUTES.corporate.services}#diagnosis`, label: "Diagnosis" },
      { href: `${ROUTES.corporate.services}#after-sales`, label: "After-Sales" },
      { href: ROUTES.auto.spareParts, label: "Spare Parts" },
    ],
  },
  { href: ROUTES.auto.financing, label: "Finance" },
  { href: ROUTES.corporate.freightTracking, label: "Track" },
  { href: ROUTES.corporate.about, label: "About" },
];

export const NABUS_UTILITY_LINKS: NabusNavLink[] = [
  { href: ROUTES.corporate.freight, label: "Import & Logistics" },
  { href: ROUTES.auto.garage, label: "My Garage" },
  { href: ROUTES.corporate.account, label: "Account" },
];

export function flattenNavItems(items: NabusNavItem[]): NabusNavLink[] {
  const out: NabusNavLink[] = [];
  for (const item of items) {
    if ("children" in item && item.children) {
      out.push(...item.children);
    } else if ("href" in item && item.href) {
      out.push({ href: item.href, label: item.label });
    }
  }
  return out;
}
