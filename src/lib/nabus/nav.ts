/** Primary public navigation — Nabus Motors editorial showroom. */
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

export const NABUS_PRIMARY_NAV: NabusNavItem[] = [
  { href: ROUTES.auto.inventory, label: "Cars" },
  { href: `${ROUTES.auto.inventory}?sort=newest`, label: "New In" },
  { href: `${ROUTES.auto.inventory}#collections`, label: "Collections" },
  { href: ROUTES.auto.financing, label: "Finance" },
  { href: ROUTES.auto.sell, label: "Sell" },
  { href: ROUTES.corporate.about, label: "About" },
];

export const NABUS_UTILITY_LINKS: NabusNavLink[] = [
  { href: ROUTES.auto.garage, label: "Saved" },
  { href: ROUTES.corporate.account, label: "Account" },
  { href: ROUTES.corporate.contact, label: "Visit Showroom" },
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
