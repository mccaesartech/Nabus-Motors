"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isCustomerPublicPath } from "@/lib/pwa/routes";

const PwaServiceWorkerRegistrar = dynamic(
  () =>
    import("@/components/pwa/pwa-service-worker-registrar").then((m) => ({
      default: m.PwaServiceWorkerRegistrar,
    })),
  { ssr: false }
);

const InstallPrompt = dynamic(
  () =>
    import("@/components/pwa/install-prompt").then((m) => ({
      default: m.InstallPrompt,
    })),
  { ssr: false }
);

/**
 * Customer PWA shell — only on public routes so admin pages keep a separate install identity.
 */
export function ConditionalPwaShell() {
  const pathname = usePathname() ?? "";

  if (!isCustomerPublicPath(pathname)) {
    return null;
  }

  return (
    <>
      <PwaServiceWorkerRegistrar />
      <InstallPrompt variant="customer" />
    </>
  );
}
