/**
 * Web Push subscription helpers (client-side).
 * Backend delivery requires VAPID keys — see docs/PWA_IMPLEMENTATION.md.
 */

export type PushSubscriptionRole = "customer" | "admin";

export type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type StoredPushSubscription = PushSubscriptionPayload & {
  role: PushSubscriptionRole;
  userAgent?: string;
};

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

export function serializePushSubscription(
  subscription: PushSubscription
): PushSubscriptionPayload {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Push subscription is missing required keys.");
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function subscribeToPush(
  role: PushSubscriptionRole
): Promise<StoredPushSubscription | null> {
  if (!isPushSupported()) return null;

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await getPushRegistration();
  if (!registration) return null;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  return {
    ...serializePushSubscription(subscription),
    role,
    userAgent: navigator.userAgent,
  };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await getPushRegistration();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  return subscription.unsubscribe();
}

export async function persistPushSubscription(
  payload: StoredPushSubscription,
  authHeader?: string | null
): Promise<{ ok: boolean; message?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = authHeader;

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  return { ok: res.ok && Boolean(data.ok), message: data.message };
}
