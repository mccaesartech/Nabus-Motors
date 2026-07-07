import {
  AUTO_DIVISION,
  CORPORATE_HOME,
  FREIGHT_DIVISION,
  ROUTES,
} from "@/lib/routes";

export type CustomerBackNavConfig = {
  label: string;
  fallbackHref: string;
};

/** Division landing pages — no global back bar. */
const LANDING_PATHS = new Set<string>([
  CORPORATE_HOME,
  AUTO_DIVISION,
  FREIGHT_DIVISION,
]);

const CORPORATE_SUBPAGES = [
  ROUTES.corporate.about,
  ROUTES.corporate.services,
  ROUTES.corporate.contact,
  "/terms",
  "/privacy",
] as const;

function isAutoInventoryDetail(pathname: string): boolean {
  return (
    pathname.startsWith(`${ROUTES.auto.inventory}/`) &&
    pathname !== ROUTES.auto.customRequest
  );
}

/**
 * Resolve back-navigation label and fallback for customer-facing routes.
 * Returns null on home/division landing pages and unmatched paths.
 */
export function getCustomerBackNav(pathname: string): CustomerBackNavConfig | null {
  if (!pathname || LANDING_PATHS.has(pathname)) return null;

  if (pathname === ROUTES.corporate.login || pathname === ROUTES.corporate.register) {
    return { label: "Back to home", fallbackHref: CORPORATE_HOME };
  }

  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    return { label: "Back to sign in", fallbackHref: ROUTES.corporate.login };
  }

  if (
    pathname === ROUTES.corporate.account ||
    pathname.startsWith(`${ROUTES.corporate.account}/`)
  ) {
    return { label: "Back to home", fallbackHref: CORPORATE_HOME };
  }

  if (pathname === ROUTES.auto.customRequest) {
    return {
      label: "Back to pre-order inventory",
      fallbackHref: ROUTES.auto.preorder,
    };
  }

  if (isAutoInventoryDetail(pathname)) {
    return { label: "Back to inventory", fallbackHref: ROUTES.auto.inventory };
  }

  if (pathname === ROUTES.auto.inventory) {
    return { label: "Back to Auto Division", fallbackHref: ROUTES.auto.home };
  }

  if (pathname.startsWith(`${ROUTES.auto.spareParts}/`)) {
    return { label: "Back to spare parts", fallbackHref: ROUTES.auto.spareParts };
  }

  if (pathname === ROUTES.auto.spareParts) {
    return { label: "Back to Auto Division", fallbackHref: ROUTES.auto.home };
  }

  if (pathname === ROUTES.auto.cart || pathname.startsWith(`${ROUTES.auto.cart}/`)) {
    return { label: "Back to inventory", fallbackHref: ROUTES.auto.inventory };
  }

  const autoSubpages = [
    ROUTES.auto.buy,
    ROUTES.auto.sell,
    ROUTES.auto.financing,
    ROUTES.auto.garage,
  ] as const;

  if (autoSubpages.includes(pathname as (typeof autoSubpages)[number])) {
    return { label: "Back to Auto Division", fallbackHref: ROUTES.auto.home };
  }

  if (pathname.startsWith(`${AUTO_DIVISION}/`)) {
    return { label: "Back to Auto Division", fallbackHref: ROUTES.auto.home };
  }

  if (
    pathname === ROUTES.corporate.freightTracking ||
    pathname.startsWith(`${ROUTES.corporate.freightTracking}/`)
  ) {
    return { label: "Back to freight services", fallbackHref: FREIGHT_DIVISION };
  }

  if (
    pathname === ROUTES.corporate.shippingConsultation ||
    pathname.startsWith(`${ROUTES.corporate.shippingConsultation}/`)
  ) {
    return { label: "Back to freight services", fallbackHref: FREIGHT_DIVISION };
  }

  if (CORPORATE_SUBPAGES.includes(pathname as (typeof CORPORATE_SUBPAGES)[number])) {
    return { label: "Back to home", fallbackHref: CORPORATE_HOME };
  }

  return null;
}
