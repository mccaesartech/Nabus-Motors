/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Bump when cache strategy changes so old runtime caches are abandoned. */
const CACHE_VERSION = "v4";

const AUTH_API_PREFIXES = [
  "/api/admin/login",
  "/api/admin/logout",
  "/api/customer/",
  "/api/push/subscribe",
];

function isAuthSensitiveApi(pathname: string): boolean {
  return AUTH_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, url }) =>
      request.destination === "document" &&
      !url.pathname.startsWith("/admin") &&
      !url.pathname.startsWith("/platform"),
    handler: new NetworkFirst({
      cacheName: `pages-${CACHE_VERSION}`,
      // Keep short so slow networks fall back to cache quickly (felt as snappier nav).
      networkTimeoutSeconds: 3,
      plugins: [],
    }),
  },
  {
    matcher: ({ url }) => {
      const { pathname } = url;
      return pathname.startsWith("/api/") && !isAuthSensitiveApi(pathname);
    },
    handler: new NetworkFirst({
      cacheName: `api-public-${CACHE_VERSION}`,
      networkTimeoutSeconds: 6,
      plugins: [],
    }),
  },
  {
    matcher: ({ url }) => {
      const { pathname } = url;
      return pathname.startsWith("/api/") && isAuthSensitiveApi(pathname);
    },
    handler: new NetworkFirst({
      cacheName: `api-auth-${CACHE_VERSION}`,
      networkTimeoutSeconds: 4,
      plugins: [],
    }),
  },
  // Non-hashed app scripts/styles: revalidate so deploys are not pinned forever.
  {
    matcher: ({ request, url }) =>
      (request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker") &&
      !url.pathname.startsWith("/_next/static/"),
    handler: new StaleWhileRevalidate({
      cacheName: `static-scripts-styles-${CACHE_VERSION}`,
    }),
  },
  {
    matcher: ({ request }) =>
      request.destination === "font" || request.destination === "image",
    handler: new StaleWhileRevalidate({
      cacheName: `static-assets-${CACHE_VERSION}`,
    }),
  },
  // Content-hashed Next assets — safe to CacheFirst.
  {
    matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: `next-static-${CACHE_VERSION}`,
    }),
  },
  {
    matcher: ({ url }) => url.pathname.startsWith("/icons/"),
    handler: new CacheFirst({
      cacheName: `pwa-icons-${CACHE_VERSION}`,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Activate immediately; the page registrar reloads once on controlling updates.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

/** Drop abandoned runtime caches from older SW versions. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => {
            if (key.startsWith("serwist-precache")) return false;
            if (key.includes(CACHE_VERSION)) return false;
            return (
              key.startsWith("pages") ||
              key.startsWith("api-") ||
              key.startsWith("static-") ||
              key.startsWith("next-static") ||
              key.startsWith("pwa-icons")
            );
          })
          .map((key) => caches.delete(key))
      );
    })()
  );
});

/** Push notification handler stub — wire to backend when VAPID is configured. */
self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
    } catch {
      return undefined;
    }
  })();

  const title = data?.title ?? "Nabus Motors";
  const body = data?.body ?? "You have a new notification.";
  const url = data?.url ?? "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
