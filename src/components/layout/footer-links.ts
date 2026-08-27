import { ROUTES } from "@/lib/routes";

export type FooterNavLink = {
  href: string;
  label: string;
};

export const footerCompanyLinks: FooterNavLink[] = [
  { href: ROUTES.corporate.home, label: "Company Home" },
  { href: ROUTES.corporate.about, label: "About Us" },
  { href: ROUTES.corporate.services, label: "Services" },
  { href: ROUTES.corporate.contact, label: "Contact" },
  { href: ROUTES.auto.home, label: "Auto Division" },
  { href: ROUTES.corporate.freight, label: "Freight & Clearing" },
  { href: ROUTES.auto.spareParts, label: "Spare Parts" },
  { href: ROUTES.auto.financing, label: "Financing" },
  { href: ROUTES.corporate.shippingConsultation, label: "Shipping Consultation" },
];

/** Kept in sync with homepage browse-by-category routes. */
export const footerInventoryLinks: FooterNavLink[] = [
  { href: ROUTES.auto.inventory, label: "All Inventory" },
  { href: `${ROUTES.auto.inventory}?bodyType=SUV`, label: "SUVs" },
  { href: `${ROUTES.auto.inventory}?bodyType=Sedan`, label: "Sedans" },
  { href: `${ROUTES.auto.inventory}?bodyType=Luxury`, label: "Luxury" },
  { href: `${ROUTES.auto.inventory}?bodyType=Truck`, label: "Trucks" },
  { href: `${ROUTES.auto.inventory}?bodyType=Commercial`, label: "Commercial" },
  { href: `${ROUTES.auto.inventory}?fuelType=Electric`, label: "Electric" },
  { href: `${ROUTES.auto.inventory}?chinese=1`, label: "Chinese Brands" },
];

export const footerLegalLinks: FooterNavLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export function isValidExternalHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return false;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("mailto:");
}
