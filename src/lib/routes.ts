/**
 * Public route paths — single source of truth for corporate HQ vs divisions.
 *
 * Route map:
 *   /                           → True Goshen Company Limited (corporate HQ)
 *   /about, /services, /contact → Corporate pages
 *   /auto/*                     → Auto Division (marketplace)
 *   /auto/spare-parts           → Spare Parts (subdivision of Auto)
 *   /freight-forwarding/*       → Freight & Clearing Division
 *   /shipping-consultation      → Shipping consultation
 *   /platform/*, /admin/*       → Admin (unchanged)
 */

export const CORPORATE_HOME = "/" as const;
export const AUTO_DIVISION = "/auto" as const;
export const FREIGHT_DIVISION = "/freight-forwarding" as const;
export const SHIPPING_CONSULTATION = "/shipping-consultation" as const;

export const ROUTES = {
  corporate: {
    home: CORPORATE_HOME,
    about: "/about",
    services: "/services",
    contact: "/contact",
    freight: FREIGHT_DIVISION,
    freightTracking: `${FREIGHT_DIVISION}/tracking`,
    shippingConsultation: SHIPPING_CONSULTATION,
    appointments: "/account?section=visit",
    login: "/login",
    register: "/register",
    account: "/account",
  },
  auto: {
    home: AUTO_DIVISION,
    inventory: `${AUTO_DIVISION}/inventory`,
    inventoryDetail: (slug: string) => `${AUTO_DIVISION}/inventory/${slug}`,
    buy: `${AUTO_DIVISION}/buy`,
    sell: `${AUTO_DIVISION}/sell`,
    preorder: `${AUTO_DIVISION}/inventory?status=pre_order`,
    customRequest: `${AUTO_DIVISION}/inventory/custom-request`,
    financing: `${AUTO_DIVISION}/financing`,
    garage: `${AUTO_DIVISION}/garage`,
    compare: `${AUTO_DIVISION}/compare`,
    spareParts: `${AUTO_DIVISION}/spare-parts`,
    sparePartDetail: (slug: string) => `${AUTO_DIVISION}/spare-parts/${slug}`,
    cart: `${AUTO_DIVISION}/cart`,
    cartComplete: `${AUTO_DIVISION}/cart/complete`,
  },
} as const;

export const CORPORATE_NAV_LINKS = [
  { href: ROUTES.corporate.home, label: "Home" },
  { href: ROUTES.corporate.about, label: "About Us" },
  { href: ROUTES.corporate.services, label: "Services" },
  { href: ROUTES.auto.home, label: "Auto Division" },
  { href: ROUTES.corporate.freight, label: "Freight & Clearing" },
  { href: ROUTES.corporate.contact, label: "Contact" },
] as const;

export type DivisionId = "auto" | "freight";

export function isAutoDivisionPath(pathname: string): boolean {
  return pathname === AUTO_DIVISION || pathname.startsWith(`${AUTO_DIVISION}/`);
}

export function isFreightDivisionPath(pathname: string): boolean {
  return (
    pathname === FREIGHT_DIVISION ||
    pathname.startsWith(`${FREIGHT_DIVISION}/`) ||
    pathname === SHIPPING_CONSULTATION ||
    pathname.startsWith(`${SHIPPING_CONSULTATION}/`)
  );
}

export function getActiveDivision(pathname: string): DivisionId | null {
  if (isAutoDivisionPath(pathname)) return "auto";
  if (isFreightDivisionPath(pathname)) return "freight";
  return null;
}

export const DIVISION_LABELS: Record<DivisionId, string> = {
  auto: "Auto Division",
  freight: "Freight & Clearing Division",
};
