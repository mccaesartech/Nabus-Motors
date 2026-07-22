/** Brand colors from globals.css — used in manifests and PWA chrome. */
export const PWA_THEME_COLOR = "#4c1d95";
export const ADMIN_PWA_THEME_COLOR = "#2e1065";
export const PWA_BACKGROUND_COLOR = "#faf5ff";

export const CUSTOMER_PWA = {
  id: "true-goshen-customer",
  name: "True Goshen",
  shortName: "True Goshen",
  description:
    "True Goshen Company Limited — vehicle imports, freight forwarding, customs clearing, and genuine spare parts.",
  startUrl: "/",
  scope: "/",
  manifestPath: "/manifest.webmanifest",
} as const;

export const ADMIN_PWA = {
  id: "true-goshen-admin",
  name: "True Goshen Admin",
  shortName: "TG Admin",
  description: "True Goshen platform admin — secure dashboard for inventory, freight, and operations.",
  startUrl: "/admin",
  scope: "/admin",
  manifestPath: "/admin/manifest.webmanifest",
} as const;

/**
 * Entry points where the platform PWA can be installed.
 * The platform prefix covers every authenticated role without coupling installation to Settings.
 */
export const ADMIN_PWA_INSTALL_PATHS = ["/admin", "/admin/platform"] as const;

export const INSTALL_PROMPT_DISMISS_KEY_CUSTOMER = "tg-pwa-install-dismissed-customer";
export const INSTALL_PROMPT_DISMISS_KEY_ADMIN = "tg-pwa-install-dismissed-admin";
export const INSTALL_BANNER_DISMISS_KEY_ADMIN = "tg-pwa-install-banner-dismissed-admin";
export const INSTALL_BANNER_SESSION_KEY_ADMIN = "tg-pwa-install-banner-session-admin";
export const INSTALL_BANNER_DISMISS_KEY_CUSTOMER = "tg-pwa-customer-install-dismissed";
export const INSTALL_BANNER_SESSION_KEY_CUSTOMER = "tg-pwa-customer-install-session";
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
