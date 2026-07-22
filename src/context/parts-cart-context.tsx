"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCustomerAuth } from "@/context/customer-auth-context";
import {
  cartLineKey,
  deduplicateCartItems,
  isPartLine,
  isVehicleLine,
  normalizeCartLine,
  resolveCartVehicleIntent,
  vehicleLinesMatch,
  type CartLineInput,
  type CartPartSnapshot,
  type CartVehicleIntent,
  type CartVehicleSnapshot,
} from "@/lib/parts/cart-types";

const STORAGE_KEY = "true-goshen-cart";
const LEGACY_STORAGE_KEY = "true-goshen-parts-cart";
const CART_EVENT = "true-goshen-cart-change";

type CartContextValue = {
  items: CartLineInput[];
  itemCount: number;
  loaded: boolean;
  addPart: (partId: string, quantity?: number, snapshot?: CartPartSnapshot) => void;
  addVehicle: (
    vehicleId: string,
    intent?: CartVehicleIntent,
    snapshot?: CartVehicleSnapshot,
    quantity?: number
  ) => void;
  removePart: (partId: string) => void;
  removeVehicle: (vehicleId: string) => void;
  /** Migrate a legacy slug cart key to the canonical vehicle UUID after lookup. */
  rekeyVehicle: (fromId: string, toId: string) => void;
  setPartQuantity: (partId: string, quantity: number) => void;
  setVehicleQuantity: (vehicleId: string, quantity: number) => void;
  clearCart: () => void;
  clearVehicles: () => void;
  clearParts: () => void;
  clearByIntent: (intent: CartVehicleIntent) => void;
  /** Remove cart lines by `cartLineKey` values (e.g. `part:uuid`, `vehicle:uuid`). */
  removeCheckoutItems: (itemKeys: string[]) => void;
  isPartInCart: (partId: string) => boolean;
  isVehicleInCart: (vehicleId: string) => boolean;
  getPartQuantity: (partId: string) => number;
  getVehicleQuantity: (vehicleId: string) => number;
  /** @deprecated Use addPart */
  addItem: (partId: string, quantity?: number) => void;
  /** @deprecated Use removePart */
  removeItem: (partId: string) => void;
  /** @deprecated Use setPartQuantity */
  setQuantity: (partId: string, quantity: number) => void;
  /** @deprecated Use isPartInCart */
  isInCart: (partId: string) => boolean;
  /** @deprecated Use getPartQuantity */
  getQuantity: (partId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

let cartSnapshot: CartLineInput[] = [];
let cartSnapshotRaw: string | null = "";

function parseStoredItems(raw: string | null): CartLineInput[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as { items?: unknown[] };
    if (!Array.isArray(parsed.items)) return [];

    const lines: CartLineInput[] = [];
    for (const entry of parsed.items) {
      const line = normalizeCartLine(entry);
      if (line) lines.push(line);
    }

    return deduplicateCartItems(lines);
  } catch {
    return [];
  }
}

function readCart(): CartLineInput[] {
  if (typeof window === "undefined") return [];

  try {
    let raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const migrated = parseStoredItems(legacyRaw);
        if (migrated.length > 0) {
          writeCart(migrated);
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }

    if (raw === cartSnapshotRaw) return cartSnapshot;
    cartSnapshotRaw = raw;
    cartSnapshot = parseStoredItems(raw);
    return cartSnapshot;
  } catch {
    return [];
  }
}

function writeCart(items: CartLineInput[]) {
  try {
    const deduped = deduplicateCartItems(items);
    const raw = JSON.stringify({ items: deduped });
    localStorage.setItem(STORAGE_KEY, raw);
    cartSnapshotRaw = raw;
    cartSnapshot = deduped;
  } catch {
    // ignore quota / private-mode errors
  }
}

function notifyCartChange() {
  window.dispatchEvent(new Event(CART_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function mergeItems(
  local: CartLineInput[],
  remote: CartLineInput[]
): CartLineInput[] {
  const dedupedLocal = deduplicateCartItems(local);
  const dedupedRemote = deduplicateCartItems(remote);
  const map = new Map<string, CartLineInput>();

  for (const item of dedupedRemote) {
    map.set(cartLineKey(item), item);
  }

  for (const item of dedupedLocal) {
    const key = cartLineKey(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }

    if (isPartLine(item) && isPartLine(existing)) {
      map.set(key, {
        ...item,
        snapshot: item.snapshot ?? existing.snapshot,
      });
    } else if (isVehicleLine(item) && isVehicleLine(existing)) {
      map.set(key, {
        ...item,
        snapshot: item.snapshot ?? existing.snapshot,
        intent: item.intent ?? existing.intent,
      });
    }
  }

  return deduplicateCartItems(Array.from(map.values()));
}

export function PartsCartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, readCart, () => []);
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { user, getAccessToken, loading: authLoading } = useCustomerAuth();
  const syncRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRef = useRef<CartLineInput[] | null>(null);

  const persistLocal = useCallback((next: CartLineInput[]) => {
    writeCart(next);
    notifyCartChange();
  }, []);

  const syncToServer = useCallback(
    async (nextItems: CartLineInput[]) => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const res = await fetch("/api/customer/cart", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items: nextItems }),
        });
        if (!res.ok && process.env.NODE_ENV === "development") {
          const json = await res.json().catch(() => ({}));
          console.warn(
            "[cart] Server sync failed:",
            json.message ?? res.statusText
          );
        }
      } catch {
        // non-blocking — localStorage remains source of truth
      } finally {
        if (pendingSyncRef.current === nextItems) {
          pendingSyncRef.current = null;
        }
      }
    },
    [getAccessToken]
  );

  const flushServerSync = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSyncRef.current;
    if (pending) {
      void syncToServer(pending);
    }
  }, [syncToServer]);

  const scheduleServerSync = useCallback(
    (nextItems: CartLineInput[], immediate = false) => {
      if (!user) return;
      pendingSyncRef.current = nextItems;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (immediate) {
        void syncToServer(nextItems);
        return;
      }
      saveTimerRef.current = setTimeout(() => {
        void syncToServer(nextItems);
      }, 400);
    },
    [user, syncToServer]
  );

  const addPart = useCallback(
    (partId: string, quantity = 1, snapshot?: CartPartSnapshot) => {
      const current = readCart();
      const existing = current.find(
        (item) => isPartLine(item) && item.partId === partId
      );
      const next = existing && isPartLine(existing)
        ? current.map((item) =>
            isPartLine(item) && item.partId === partId
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  ...(snapshot ? { snapshot } : {}),
                }
              : item
          )
        : [
            ...current,
            {
              itemType: "part" as const,
              partId,
              quantity,
              ...(snapshot ? { snapshot } : {}),
            },
          ];
      persistLocal(next);
      scheduleServerSync(next, true);
    },
    [persistLocal, scheduleServerSync]
  );

  const addVehicle = useCallback(
    (
      vehicleId: string,
      intent: CartVehicleIntent = "buy",
      snapshot?: CartVehicleSnapshot,
      quantity = 1
    ) => {
      const current = readCart();
      const candidate = {
        itemType: "vehicle" as const,
        vehicleId,
        quantity,
        intent,
        ...(snapshot ? { snapshot } : {}),
      };
      const existing = current.find(
        (item) => isVehicleLine(item) && vehicleLinesMatch(item, candidate)
      );

      const next: CartLineInput[] =
        existing && isVehicleLine(existing)
          ? current.map((item) =>
              isVehicleLine(item) && vehicleLinesMatch(item, existing)
                ? {
                    ...item,
                    vehicleId,
                    quantity: item.quantity + quantity,
                    intent: intent ?? item.intent,
                    ...(snapshot ? { snapshot } : {}),
                  }
                : item
            )
          : [
              ...current,
              {
                itemType: "vehicle",
                vehicleId,
                quantity,
                intent,
                ...(snapshot ? { snapshot } : {}),
              },
            ];
      persistLocal(next);
      scheduleServerSync(next, true);
    },
    [persistLocal, scheduleServerSync]
  );

  const removePart = useCallback(
    (partId: string) => {
      const next = readCart().filter(
        (item) => !(isPartLine(item) && item.partId === partId)
      );
      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, scheduleServerSync]
  );

  const removeVehicle = useCallback(
    (vehicleId: string) => {
      const next = readCart().filter(
        (item) => !(isVehicleLine(item) && item.vehicleId === vehicleId)
      );
      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, scheduleServerSync]
  );

  const rekeyVehicle = useCallback(
    (fromId: string, toId: string) => {
      if (!fromId || !toId || fromId === toId) return;

      const current = readCart();
      const hasTarget = current.some(
        (item) => isVehicleLine(item) && item.vehicleId === toId
      );
      const source = current.find(
        (item) => isVehicleLine(item) && item.vehicleId === fromId
      );
      if (!source || !isVehicleLine(source)) return;

      const next = hasTarget
        ? current
            .filter(
              (item) => !(isVehicleLine(item) && item.vehicleId === fromId)
            )
            .map((item) =>
              isVehicleLine(item) && item.vehicleId === toId
                ? {
                    ...item,
                    quantity: Math.max(item.quantity, source.quantity),
                    snapshot: item.snapshot ?? source.snapshot,
                    intent: item.intent ?? source.intent,
                  }
                : item
            )
        : current.map((item) =>
            isVehicleLine(item) && item.vehicleId === fromId
              ? { ...item, vehicleId: toId }
              : item
          );

      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, scheduleServerSync]
  );

  const setPartQuantity = useCallback(
    (partId: string, quantity: number) => {
      if (quantity < 1) {
        removePart(partId);
        return;
      }
      const current = readCart();
      const next = current.map((item) =>
        isPartLine(item) && item.partId === partId
          ? { ...item, quantity }
          : item
      );
      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, removePart, scheduleServerSync]
  );

  const setVehicleQuantity = useCallback(
    (vehicleId: string, quantity: number) => {
      if (quantity < 1) {
        removeVehicle(vehicleId);
        return;
      }
      const current = readCart();
      const next = current.map((item) =>
        isVehicleLine(item) && item.vehicleId === vehicleId
          ? { ...item, quantity }
          : item
      );
      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, removeVehicle, scheduleServerSync]
  );

  const clearCart = useCallback(() => {
    persistLocal([]);
    scheduleServerSync([], true);
  }, [persistLocal, scheduleServerSync]);

  const clearVehicles = useCallback(() => {
    const next = readCart().filter((item) => !isVehicleLine(item));
    persistLocal(next);
    scheduleServerSync(next);
  }, [persistLocal, scheduleServerSync]);

  const clearParts = useCallback(() => {
    const next = readCart().filter((item) => !isPartLine(item));
    persistLocal(next);
    scheduleServerSync(next);
  }, [persistLocal, scheduleServerSync]);

  const clearByIntent = useCallback(
    (intent: CartVehicleIntent) => {
      const next = readCart().filter((item) => {
        if (!isVehicleLine(item)) return true;
        return resolveCartVehicleIntent(item) !== intent;
      });
      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, scheduleServerSync]
  );

  const removeCheckoutItems = useCallback(
    (itemKeys: string[]) => {
      if (itemKeys.length === 0) return;
      const keys = new Set(itemKeys);
      const next = readCart().filter((item) => !keys.has(cartLineKey(item)));
      persistLocal(next);
      scheduleServerSync(next);
    },
    [persistLocal, scheduleServerSync]
  );

  const isPartInCart = useCallback(
    (partId: string) =>
      items.some((item) => isPartLine(item) && item.partId === partId),
    [items]
  );

  const isVehicleInCart = useCallback(
    (vehicleId: string) =>
      items.some(
        (item) =>
          isVehicleLine(item) && vehicleLinesMatch(item, { vehicleId })
      ),
    [items]
  );

  const getPartQuantity = useCallback(
    (partId: string) =>
      items.find((item) => isPartLine(item) && item.partId === partId)
        ?.quantity ?? 0,
    [items]
  );

  const getVehicleQuantity = useCallback(
    (vehicleId: string) =>
      items.find(
        (item) =>
          isVehicleLine(item) && vehicleLinesMatch(item, { vehicleId })
      )?.quantity ?? 0,
    [items]
  );

  useEffect(() => {
    if (authLoading || !user || syncRef.current) return;

    let cancelled = false;

    async function mergeOnLogin() {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      try {
        const res = await fetch("/api/customer/cart", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;

        const json = await res.json();
        const remote: CartLineInput[] = (json.items ?? [])
          .map(normalizeCartLine)
          .filter((line: CartLineInput | null): line is CartLineInput => line != null);
        const merged = mergeItems(readCart(), remote);

        persistLocal(merged);
        await syncToServer(merged);
        syncRef.current = true;
      } catch {
        // keep local cart
      }
    }

    const run = () => {
      if (!cancelled) void mergeOnLogin();
    };

    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      timerId = setTimeout(run, 150);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [authLoading, user, getAccessToken, persistLocal, syncToServer]);

  useEffect(() => {
    if (!user) {
      syncRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    const flush = () => flushServerSync();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [flushServerSync]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      itemCount,
      loaded,
      addPart,
      addVehicle,
      removePart,
      removeVehicle,
      rekeyVehicle,
      setPartQuantity,
      setVehicleQuantity,
      clearCart,
      clearVehicles,
      clearParts,
      clearByIntent,
      removeCheckoutItems,
      isPartInCart,
      isVehicleInCart,
      getPartQuantity,
      getVehicleQuantity,
      addItem: addPart,
      removeItem: removePart,
      setQuantity: setPartQuantity,
      isInCart: isPartInCart,
      getQuantity: getPartQuantity,
    }),
    [
      items,
      itemCount,
      loaded,
      addPart,
      addVehicle,
      removePart,
      removeVehicle,
      rekeyVehicle,
      setPartQuantity,
      setVehicleQuantity,
      clearCart,
      clearVehicles,
      clearParts,
      clearByIntent,
      removeCheckoutItems,
      isPartInCart,
      isVehicleInCart,
      getPartQuantity,
      getVehicleQuantity,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function usePartsCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("usePartsCart must be used within PartsCartProvider");
  }
  return ctx;
}

export function usePartsCartCount() {
  const ctx = useContext(CartContext);
  if (!ctx) return { cartCount: 0, loaded: false };
  return { cartCount: ctx.itemCount, loaded: ctx.loaded };
}

export const CartProvider = PartsCartProvider;
export const useCart = usePartsCart;
export const useCartCount = usePartsCartCount;
