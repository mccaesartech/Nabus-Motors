/** Brand colors from globals.css — used in manifests and PWA chrome. */
export const PWA_THEME_COLOR = "#941D30";
export const ADMIN_PWA_THEME_COLOR = "#292725";
export const PWA_BACKGROUND_COLOR = "#F7F4EE";

export const CUSTOMER_PWA = {
  id: "nabus-motors-customer",
  name: "Nabus Motors",
  shortName: "Nabus",
  description:
    "Nabus Motors and Trading — drive your dream car with verified vehicles, flexible financing, and trusted service in Accra, Ghana.",
  startUrl: "/",
  scope: "/",
  manifestPath: "/manifest.webmanifest",
} as const;

export const ADMIN_PWA = {
  id: "nabus-motors-admin",
  name: "Nabus Motors Admin",
  shortName: "Nabus Admin",
  description: "Nabus Motors platform admin — secure dashboard for inventory and operations.",
  startUrl: "/admin",
  scope: "/admin",
  manifestPath: "/admin/manifest.webmanifest",
} as const;

/**
 * Entry points where the platform PWA can be installed.
 * The platform prefix covers every authenticated role without coupling installation to Settings.
 */
export const ADMIN_PWA_INSTALL_PATHS = ["/admin", "/admin/platform"] as const;

export const INSTALL_PROMPT_DISMISS_KEY_CUSTOMER = "nm-pwa-install-dismissed-customer";
export const INSTALL_PROMPT_DISMISS_KEY_ADMIN = "nm-pwa-install-dismissed-admin";
export const INSTALL_BANNER_DISMISS_KEY_ADMIN = "nm-pwa-install-banner-dismissed-admin";
export const INSTALL_BANNER_SESSION_KEY_ADMIN = "nm-pwa-install-banner-session-admin";
export const INSTALL_BANNER_DISMISS_KEY_CUSTOMER = "nm-pwa-customer-install-dismissed";
export const INSTALL_BANNER_SESSION_KEY_CUSTOMER = "nm-pwa-customer-install-session";
/** @deprecated Use variant-specific keys */
export const INSTALL_PROMPT_DISMISS_KEY = INSTALL_PROMPT_DISMISS_KEY_CUSTOMER;
export const INSTALL_PROMPT_DISMISS_DAYS = 14;
export const INSTALL_BANNER_DISMISS_DAYS = 7;

export type PwaVariant = "customer" | "admin";

export function installPromptDismissKey(variant: PwaVariant): string {
  return variant === "admin"
    ? INSTALL_PROMPT_DISMISS_KEY_ADMIN
    : INSTALL_PROMPT_DISMISS_KEY_CUSTOMER;
}
