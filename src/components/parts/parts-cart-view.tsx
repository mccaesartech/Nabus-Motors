"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { CartQuantityStepper } from "@/components/parts/cart-quantity-stepper";
import { CartPreorderPanel } from "@/components/parts/cart-preorder-panel";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import { usePartsCart } from "@/context/parts-cart-context";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { formatCheckoutPrice } from "@/lib/currency/checkout";
import { ROUTES } from "@/lib/routes";
import { saveCheckoutCompleteContext } from "@/lib/checkout/complete-context";
import {
  buildCheckoutOrderSummary,
  buildPreorderPrintSnapshot,
} from "@/lib/checkout/print-snapshot";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { isPreOrderStatus, resolveVehicleCheckoutMode } from "@/lib/vehicles/availability";
import {
  collectCartVehicleLookupKeys,
  matchCartVehicleToLookup,
  buildLookupVehicleMap,
  resolveCartVehicleDetailHref,
  resolveCartVehicleDisplayState,
  vehicleAvailabilityBadgeLabel,
} from "@/lib/vehicles/cart-lookup";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  cartLineKey,
  isPartLine,
  isVehicleLine,
  partLineFromSnapshot,
  resolveCartVehicleIntent,
  vehicleLineFromSnapshot,
  type CartLineResolved,
  type CartVehicleResolved,
  type CartVehicleCatalogState,
} from "@/lib/parts/cart-types";
import type { PublishedPart } from "@/lib/data/parts";
import type { Vehicle } from "@/lib/types";
import type { VehicleLookupUnresolved } from "@/lib/supabase/vehicles";

const LOOKUP_TIMEOUT_MS = 4_000;

function resolveLineCatalog(
  line: Pick<CartVehicleResolved, "vehicleId" | "slug">,
  catalog?: Record<string, CartVehicleCatalogState>
): CartVehicleCatalogState | undefined {
  if (!catalog) return undefined;
  return catalog[line.vehicleId] ?? catalog[line.slug];
}

function resolveLineUnresolvedReason(
  line: Pick<CartVehicleResolved, "vehicleId" | "slug">,
  unresolved: VehicleLookupUnresolved[]
): VehicleLookupUnresolved["reason"] | undefined {
  for (const entry of unresolved) {
    if (entry.identifier === line.vehicleId || entry.identifier === line.slug) {
      return entry.reason;
    }
  }
  return undefined;
}

function CartLineSkeleton() {
  return (
    <li className="flex animate-pulse flex-col gap-4 p-4 sm:flex-row sm:items-start">
      <div className="size-14 shrink-0 rounded-lg bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
      <div className="h-8 w-20 rounded bg-muted sm:shrink-0" />
    </li>
  );
}

export function PartsCartView() {
  const router = useRouter();
  const {
    items,
    itemCount,
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
  } = usePartsCart();
  const { user, profile, displayName, getAccessToken } = useCustomerAuth();
  const formatCartPrice = (usd: number) => formatCheckoutPrice(usd);

  const [partLines, setPartLines] = useState<CartLineResolved[]>([]);
  const [vehicleLines, setVehicleLines] = useState<CartVehicleResolved[]>([]);
  const [lookupDone, setLookupDone] = useState(true);
  const [lookupError, setLookupError] = useState(false);
  const [vehicleUnresolved, setVehicleUnresolved] = useState<
    VehicleLookupUnresolved[]
  >([]);
  const [vehicleCatalog, setVehicleCatalog] = useState<
    Record<string, CartVehicleCatalogState>
  >({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const partItems = useMemo(
    () => items.filter(isPartLine),
    [items]
  );
  const vehicleItems = useMemo(
    () => items.filter(isVehicleLine),
    [items]
  );

  useEffect(() => {
    if (user) {
      setName(displayName);
      setEmail(user.email ?? "");
      setPhone(profile?.phone ?? "");
    }
  }, [user, displayName, profile?.phone]);

  const optimisticPartLines = useMemo(
    () =>
      partItems
        .map(partLineFromSnapshot)
        .filter((line): line is CartLineResolved => line != null),
    [partItems]
  );

  const optimisticVehicleLines = useMemo(
    () =>
      vehicleItems
        .map(vehicleLineFromSnapshot)
        .filter((line): line is CartVehicleResolved => line != null),
    [vehicleItems]
  );

  const displayPartLines = useMemo(() => {
    const qtyByPartId = new Map(partItems.map((item) => [item.partId, item.quantity]));
    const base =
      partLines.length === 0
        ? optimisticPartLines
        : (() => {
            const fetchedIds = new Set(partLines.map((l) => l.partId));
            const pending = optimisticPartLines.filter(
              (l) => !fetchedIds.has(l.partId)
            );
            return [...partLines, ...pending];
          })();

    return base.map((line) => ({
      ...line,
      quantity: qtyByPartId.get(line.partId) ?? line.quantity,
    }));
  }, [partLines, optimisticPartLines, partItems]);

  const displayVehicleLines = useMemo(() => {
    const qtyByVehicleId = new Map(
      vehicleItems.map((item) => [item.vehicleId, item.quantity])
    );
    const unresolvedById = new Map(
      vehicleUnresolved.map((entry) => [entry.identifier, entry.reason])
    );

    const confirmedIds = new Set(vehicleLines.map((line) => line.vehicleId));
    const pendingSnapshots = optimisticVehicleLines.filter(
      (line) => !confirmedIds.has(line.vehicleId)
    );
    const base =
      vehicleLines.length === 0 && !lookupDone
        ? optimisticVehicleLines
        : [...vehicleLines, ...pendingSnapshots];

    return base.map((line) => {
      const unresolvedReason =
        line.unresolvedReason ??
        unresolvedById.get(line.vehicleId) ??
        unresolvedById.get(line.slug) ??
        resolveLineUnresolvedReason(line, vehicleUnresolved);
      const catalog =
        line.catalog ?? resolveLineCatalog(line, vehicleCatalog);
      const lookupConfirmed =
        line.lookupConfirmed ?? confirmedIds.has(line.vehicleId);

      return {
        ...line,
        quantity: qtyByVehicleId.get(line.vehicleId) ?? line.quantity,
        lookupConfirmed,
        unresolvedReason,
        catalog,
      };
    });
  }, [
    vehicleLines,
    optimisticVehicleLines,
    vehicleItems,
    vehicleUnresolved,
    vehicleCatalog,
    lookupDone,
  ]);

  const unresolvedPartCount = partItems.filter(
    (item) => !displayPartLines.some((l) => l.partId === item.partId)
  ).length;
  const unresolvedVehicleCount = vehicleItems.filter(
    (item) => !displayVehicleLines.some((l) => l.vehicleId === item.vehicleId)
  ).length;

  const idKey = items
    .map((item) =>
      isPartLine(item) ? `p:${item.partId}` : `v:${item.vehicleId}`
    )
    .join(",");

  useEffect(() => {
    if (items.length === 0) {
      setPartLines([]);
      setVehicleLines([]);
      setVehicleUnresolved([]);
      setVehicleCatalog({});
      setLookupDone(true);
      setLookupError(false);
      return;
    }

    let cancelled = false;
    setLookupDone(false);
    setLookupError(false);

    const partIds = partItems.map((i) => i.partId).join(",");
    const vehicleLookupKeys = collectCartVehicleLookupKeys(vehicleItems).join(",");

    async function resolveCart() {
      let partsOk = partItems.length === 0;
      let vehiclesOk = vehicleItems.length === 0;

      const requests: Promise<void>[] = [];

      if (partItems.length > 0) {
        requests.push(
          fetchWithTimeout(
            `/api/parts/lookup?ids=${encodeURIComponent(partIds)}`,
            undefined,
            LOOKUP_TIMEOUT_MS
          )
            .then((res) => res.json())
            .then((data: { parts: PublishedPart[] }) => {
              if (cancelled) return;
              partsOk = true;
              const partMap = new Map(data.parts.map((p) => [p.id, p]));
              const lines: CartLineResolved[] = [];

              for (const item of partItems) {
                const part = partMap.get(item.partId);
                if (!part || part.price_usd == null) continue;
                lines.push({
                  partId: part.id,
                  slug: part.slug,
                  name: part.name,
                  sku: part.sku,
                  priceUsd: part.price_usd,
                  quantity: item.quantity,
                  stockQuantity: part.stock_quantity,
                  image: part.images[0] ?? null,
                });
              }

              setPartLines(lines);
            })
            .catch(() => {
              if (!cancelled) partsOk = false;
            })
        );
      } else {
        setPartLines([]);
      }

      if (vehicleItems.length > 0) {
        requests.push(
          fetchWithTimeout(
            `/api/vehicles/lookup?ids=${encodeURIComponent(vehicleLookupKeys)}`,
            undefined,
            LOOKUP_TIMEOUT_MS
          )
            .then((res) => res.json())
            .then(
              (data: {
                vehicles: Vehicle[];
                unresolved?: VehicleLookupUnresolved[];
                catalog?: Record<string, CartVehicleCatalogState>;
              }) => {
              if (cancelled) return;
              vehiclesOk = true;
              const vehicleMap = buildLookupVehicleMap(data.vehicles);
              const unresolved = data.unresolved ?? [];
              const catalog = data.catalog ?? {};
              const lines: CartVehicleResolved[] = [];

              for (const item of vehicleItems) {
                const vehicle = matchCartVehicleToLookup(item, vehicleMap);
                if (!vehicle || vehicle.status === "sold") continue;

                if (vehicle.id !== item.vehicleId) {
                  rekeyVehicle(item.vehicleId, vehicle.id);
                }

                const lineCatalog =
                  catalog[vehicle.id] ??
                  catalog[vehicle.slug] ??
                  catalog[item.vehicleId] ??
                  (item.snapshot?.slug ? catalog[item.snapshot.slug] : undefined);

                lines.push({
                  vehicleId: vehicle.id,
                  slug: vehicle.slug,
                  name: formatVehicleName(vehicle),
                  priceUsd: vehicle.price,
                  quantity: item.quantity,
                  image: primaryPhotoFor(vehicle),
                  status: vehicle.status ?? null,
                  intent:
                    item.intent ??
                    (isPreOrderStatus(vehicle.status) ? "pre_order" : "buy"),
                  lookupConfirmed: true,
                  catalog: lineCatalog,
                });
              }

              setVehicleLines(lines);
              setVehicleUnresolved(unresolved);
              setVehicleCatalog(catalog);
            })
            .catch(() => {
              if (!cancelled) vehiclesOk = false;
            })
        );
      } else {
        setVehicleLines([]);
        setVehicleUnresolved([]);
        setVehicleCatalog({});
      }

      await Promise.allSettled(requests);

      if (!cancelled) {
        setLookupDone(true);
        setLookupError(!partsOk || !vehiclesOk);
      }
    }

    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const startLookup = () => {
      if (!cancelled) void resolveCart();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startLookup, { timeout: 2000 });
    } else {
      timerId = setTimeout(startLookup, 100);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [idKey, items, partItems, vehicleItems, rekeyVehicle]);

  const [completedPreorders, setCompletedPreorders] = useState<string[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const buyVehicleItems = useMemo(
    () =>
      vehicleItems.filter(
        (item) => resolveCartVehicleIntent(item) === "buy"
      ),
    [vehicleItems]
  );

  const preorderVehicleItems = useMemo(
    () =>
      vehicleItems.filter(
        (item) => resolveCartVehicleIntent(item) === "pre_order"
      ),
    [vehicleItems]
  );

  const checkoutVehicleLines = useMemo(
    () =>
      displayVehicleLines.filter((line) => {
        const displayState = resolveCartVehicleDisplayState({
          lookupDone,
          lookupConfirmed: Boolean(line.lookupConfirmed),
          unresolvedReason: line.unresolvedReason,
          status: line.status,
          intent: line.intent,
          catalog: line.catalog,
        });
        return (
          displayState === "available" &&
          !completedPreorders.includes(line.vehicleId)
        );
      }),
    [displayVehicleLines, completedPreorders, lookupDone]
  );

  const preorderVehicleLines = useMemo(
    () =>
      displayVehicleLines.filter((line) => {
        const displayState = resolveCartVehicleDisplayState({
          lookupDone,
          lookupConfirmed: Boolean(line.lookupConfirmed),
          unresolvedReason: line.unresolvedReason,
          status: line.status,
          intent: line.intent,
          catalog: line.catalog,
        });
        return (
          displayState === "preorder" &&
          !completedPreorders.includes(line.vehicleId)
        );
      }),
    [displayVehicleLines, completedPreorders, lookupDone]
  );

  /** Vehicles priced in checkout sidebar — snapshot fallback while lookup is pending. */
  const vehiclesForCheckoutSubtotal = useMemo(
    () =>
      displayVehicleLines.filter((line) => {
        if (completedPreorders.includes(line.vehicleId)) return false;

        if (!lookupDone) {
          if (line.intent === "pre_order" || isPreOrderStatus(line.status)) {
            return false;
          }
          if (line.status === "sold") return false;
          return true;
        }

        if (!line.lookupConfirmed) return false;
        return (
          resolveVehicleCheckoutMode(line.status, line.intent) === "checkout"
        );
      }),
    [displayVehicleLines, completedPreorders, lookupDone]
  );

  const unverifiedVehicleCount = useMemo(
    () =>
      displayVehicleLines.filter(
        (line) => lookupDone && !line.lookupConfirmed
      ).length,
    [displayVehicleLines, lookupDone]
  );

  const partsSubtotalUsd = useMemo(
    () =>
      displayPartLines.reduce(
        (sum, line) => sum + line.priceUsd * line.quantity,
        0
      ),
    [displayPartLines]
  );

  const checkoutVehiclesSubtotalUsd = useMemo(
    () =>
      vehiclesForCheckoutSubtotal.reduce(
        (sum, line) => sum + line.priceUsd * line.quantity,
        0
      ),
    [vehiclesForCheckoutSubtotal]
  );

  const checkoutTotalUsd = partsSubtotalUsd + checkoutVehiclesSubtotalUsd;

  const handlePreorderSuccess = useCallback(
    (
      vehicleId: string,
      payload: {
        message: string;
        inquiryId?: string;
        registrationId?: string;
        vehicleName: string;
        vehicleSlug?: string;
        vehiclePriceUsd?: number;
        downPaymentUsd?: number;
      }
    ) => {
      setCompletedPreorders((prev) => [...prev, vehicleId]);
      removeVehicle(vehicleId);

      saveCheckoutCompleteContext({
        source: "preorder",
        inquiryId: payload.inquiryId,
        registrationId: payload.registrationId,
        name: name.trim() || displayName,
        email: email.trim(),
        phone: phone.trim(),
        vehicles: [{ id: vehicleId, name: payload.vehicleName }],
        message: payload.message,
        preorder: buildPreorderPrintSnapshot({
          inquiryId: payload.inquiryId,
          registrationId: payload.registrationId,
          vehicleName: payload.vehicleName,
          vehicleSlug: payload.vehicleSlug,
          vehiclePriceUsd: payload.vehiclePriceUsd,
          downPaymentUsd: payload.downPaymentUsd,
        }),
      });
      router.push(ROUTES.auto.cartComplete);
    },
    [removeVehicle, router, name, email, phone, displayName]
  );

  const handlePreorderSkip = useCallback(
    (vehicleId: string) => {
      removeVehicle(vehicleId);
    },
    [removeVehicle]
  );

  const handleCheckout = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);

      if (displayPartLines.length === 0 && checkoutVehicleLines.length === 0) {
        return;
      }

      setSubmitting(true);

      try {
        let vehiclesToSubmit: CartVehicleResolved[] = checkoutVehicleLines;

        if (checkoutVehicleLines.length > 0) {
          const vehicleIds = collectCartVehicleLookupKeys(
            checkoutVehicleLines.map((line) => ({
              itemType: "vehicle" as const,
              vehicleId: line.vehicleId,
              quantity: line.quantity,
              intent: line.intent,
              snapshot: {
                slug: line.slug,
                name: line.name,
                priceUsd: line.priceUsd,
                image: line.image,
                status: line.status,
              },
            }))
          ).join(",");
          const refreshRes = await fetchWithTimeout(
            `/api/vehicles/lookup?ids=${encodeURIComponent(vehicleIds)}`,
            undefined,
            LOOKUP_TIMEOUT_MS
          );
          const refreshData = (await refreshRes.json()) as {
            vehicles: Vehicle[];
            unresolved?: VehicleLookupUnresolved[];
            catalog?: Record<string, CartVehicleCatalogState>;
          };
          const vehicleMap = buildLookupVehicleMap(refreshData.vehicles ?? []);
          const unresolved = refreshData.unresolved ?? [];
          const refreshed: CartVehicleResolved[] = [];
          const blocked: string[] = [];

          for (const line of checkoutVehicleLines) {
            const vehicle =
              vehicleMap.get(line.vehicleId) ?? vehicleMap.get(line.slug);
            const unresolvedReason = resolveLineUnresolvedReason(line, unresolved);

            if (!vehicle) {
              blocked.push(
                unresolvedReason === "listing_pending"
                  ? `${line.name} is pending listing approval — remove it from your cart until it is published.`
                  : `${line.name} is no longer in our catalog — please remove it from your cart.`
              );
              continue;
            }

            const status = vehicle.status ?? null;
            const intent = isPreOrderStatus(status) ? "pre_order" : line.intent;
            const mode = resolveVehicleCheckoutMode(status, intent);

            if (mode !== "checkout") {
              blocked.push(
                mode === "preorder"
                  ? `${line.name} is not available for immediate purchase — use the pre-order option above.`
                  : `${line.name} is no longer available — please remove it from your cart.`
              );
              continue;
            }

            if (vehicle.id !== line.vehicleId) {
              rekeyVehicle(line.vehicleId, vehicle.id);
            }

            refreshed.push({
              ...line,
              vehicleId: vehicle.id,
              slug: vehicle.slug,
              name: formatVehicleName(vehicle),
              priceUsd: vehicle.price,
              status,
              intent: "buy",
              image: primaryPhotoFor(vehicle),
              lookupConfirmed: true,
            });
          }

          if (blocked.length > 0) {
            setFeedback({ ok: false, text: blocked.join(" ") });
            return;
          }

          vehiclesToSubmit = refreshed;
          setVehicleLines((prev) => {
            const byId = new Map(refreshed.map((line) => [line.vehicleId, line]));
            return prev.map((line) => byId.get(line.vehicleId) ?? line);
          });
        }

        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch("/api/parts/orders", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name,
            email,
            phone,
            notes,
            items: displayPartLines.map((line) => ({
              partId: line.partId,
              quantity: line.quantity,
              partName: line.name,
              partSlug: line.slug,
              sku: line.sku,
              unitPriceUsd: line.priceUsd,
            })),
            vehicles: vehiclesToSubmit.map((line) => ({
              itemType: "vehicle" as const,
              vehicleId: line.vehicleId,
              quantity: line.quantity,
              intent: "buy" as const,
              vehicleName: line.name,
              vehicleSlug: line.slug,
              unitPriceUsd: line.priceUsd,
            })),
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          setFeedback({
            ok: false,
            text: json.message ?? "Could not submit request. Please try again.",
          });
          return;
        }

        const checkoutItemKeys = [
          ...displayPartLines.map((line) => cartLineKey({
            itemType: "part",
            partId: line.partId,
            quantity: line.quantity,
          })),
          ...vehiclesToSubmit.map((line) => cartLineKey({
            itemType: "vehicle",
            vehicleId: line.vehicleId,
            quantity: line.quantity,
          })),
        ];
        removeCheckoutItems(checkoutItemKeys);

        const submittedVehicles = (json.vehicles as Array<{ id: string | null; name: string }> | undefined)
          ?.filter((v): v is { id: string; name: string } => Boolean(v.id))
          ?? vehiclesToSubmit.map((line) => ({
            id: line.vehicleId,
            name: line.name,
          }));

        const orderId = json.orderId ? String(json.orderId) : crypto.randomUUID();
        const orderSummary = buildCheckoutOrderSummary({
          orderId,
          partLines: displayPartLines,
          vehicleLines: vehiclesToSubmit,
        });

        saveCheckoutCompleteContext({
          source: "checkout",
          orderId: json.orderId ? String(json.orderId) : undefined,
          order: orderSummary,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          vehicles: submittedVehicles,
          message: json.message ?? "Order submitted successfully.",
        });
        router.push(ROUTES.auto.cartComplete);
        return;
      } catch {
        setFeedback({ ok: false, text: "Network error. Please try again." });
      } finally {
        setSubmitting(false);
      }
    },
    [
      name,
      email,
      phone,
      notes,
      displayPartLines,
      checkoutVehicleLines,
      rekeyVehicle,
      getAccessToken,
      removeCheckoutItems,
      router,
    ]
  );

  const hasCheckoutItems =
    displayPartLines.length > 0 || checkoutVehicleLines.length > 0;

  const hasItems = items.length > 0 || itemCount > 0;
  const hasDisplayLines =
    displayPartLines.length > 0 || displayVehicleLines.length > 0;
  const showCheckoutTotal =
    hasDisplayLines &&
    (checkoutTotalUsd > 0 ||
      vehiclesForCheckoutSubtotal.length > 0 ||
      displayPartLines.length > 0);

  useEffect(() => {
    if (!lookupDone || lookupError || partLines.length === 0) return;

    const resolvedPartIds = new Set(partLines.map((l) => l.partId));
    for (const item of partItems) {
      if (resolvedPartIds.has(item.partId) || item.snapshot) continue;
      removePart(item.partId);
    }
  }, [lookupDone, lookupError, partLines, partItems, removePart]);

  useEffect(() => {
    if (!lookupDone || lookupError) return;

    const resolvedVehicleIds = new Set(vehicleLines.map((l) => l.vehicleId));
    const unresolvedIds = new Set(vehicleUnresolved.map((entry) => entry.identifier));

    for (const item of vehicleItems) {
      if (
        resolvedVehicleIds.has(item.vehicleId) ||
        unresolvedIds.has(item.vehicleId) ||
        item.snapshot
      ) {
        continue;
      }
      removeVehicle(item.vehicleId);
    }
  }, [
    lookupDone,
    lookupError,
    vehicleLines,
    vehicleUnresolved,
    vehicleItems,
    removeVehicle,
  ]);

  if (!hasItems) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center">
        <Package className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Your cart is empty</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse vehicles or spare parts and add items to your cart.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button render={<Link href={ROUTES.auto.inventory} />}>
            Browse vehicles
          </Button>
          <Button variant="outline" render={<Link href={ROUTES.auto.spareParts} />}>
            Browse spare parts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {lookupError && (
          <p className="text-sm text-amber-700">
            Could not refresh prices right now — showing saved cart details.
          </p>
        )}

        <ul className="divide-y rounded-xl border border-border/70 bg-card shadow-luxury">
          {displayVehicleLines.map((line) => {
            const lineTotal = line.priceUsd * line.quantity;
            const displayState = resolveCartVehicleDisplayState({
              lookupDone,
              lookupConfirmed: Boolean(line.lookupConfirmed),
              unresolvedReason: line.unresolvedReason,
              status: line.status,
              intent: line.intent,
              catalog: line.catalog,
            });
            const showPreorderPanel = displayState === "preorder";
            const availabilityBadge = vehicleAvailabilityBadgeLabel(displayState);
            const vehicleDetailHref = resolveCartVehicleDetailHref(line);

            return (
              <li
                key={line.vehicleId}
                className="flex flex-col gap-4 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-icon-box-border bg-icon-box-bg">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Car className="size-6 text-icon-box-fg" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {vehicleDetailHref ? (
                        <Link
                          href={vehicleDetailHref}
                          className="font-semibold text-foreground hover:text-brand-purple"
                        >
                          {line.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">{line.name}</span>
                      )}
                      <Badge
                        variant="outline"
                        className="border-brand-purple/30 text-brand-purple"
                      >
                        {availabilityBadge}
                      </Badge>
                      {line.fromSnapshot && !lookupDone && (
                        <span className="text-xs text-muted-foreground">
                          Updating…
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">
                      {formatCartPrice(line.priceUsd)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 sm:shrink-0">
                    <CartQuantityStepper
                      quantity={line.quantity}
                      min={0}
                      onDecrease={() =>
                        setVehicleQuantity(line.vehicleId, line.quantity - 1)
                      }
                      onIncrease={() =>
                        setVehicleQuantity(line.vehicleId, line.quantity + 1)
                      }
                    />
                    <p className="text-sm font-semibold">{formatCartPrice(lineTotal)}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => removeVehicle(line.vehicleId)}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>

                {showPreorderPanel && (
                  <CartPreorderPanel
                    line={line}
                    sharedName={name}
                    sharedEmail={email}
                    sharedPhone={phone}
                    onSuccess={handlePreorderSuccess}
                    onSkip={handlePreorderSkip}
                  />
                )}

                {displayState === "listing_pending" && (
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-foreground dark:border-amber-900/40 dark:bg-amber-950/20">
                    This vehicle is awaiting listing approval and cannot be purchased
                    yet. Remove it from your cart or check back after it is published.
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8"
                      onClick={() => removeVehicle(line.vehicleId)}
                    >
                      Remove from cart
                    </Button>
                  </div>
                )}

                {displayState === "not_in_catalog" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    This vehicle is not in our catalog anymore. Remove it from your cart
                    and browse current inventory.
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive"
                        onClick={() => removeVehicle(line.vehicleId)}
                      >
                        Remove from cart
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        render={<Link href={ROUTES.auto.inventory} />}
                      >
                        Browse inventory
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}

          {displayPartLines.map((line) => {
            const lineTotal = line.priceUsd * line.quantity;
            const overStock =
              line.stockQuantity > 0 && line.quantity > line.stockQuantity;

            return (
              <li
                key={line.partId}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start"
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-icon-box-border bg-icon-box-bg">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.image}
                      alt=""
                      className="size-full rounded-lg object-cover"
                    />
                  ) : (
                    <Package className="size-6 text-icon-box-fg" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={ROUTES.auto.sparePartDetail(line.slug)}
                    className="font-semibold text-foreground hover:text-brand-purple"
                  >
                    {line.name}
                  </Link>
                  {line.sku && (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      SKU: {line.sku}
                    </p>
                  )}
                  <p className="mt-1 text-sm">
                    {formatCartPrice(line.priceUsd)} each
                    {line.fromSnapshot && !lookupDone && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Updating…
                      </span>
                    )}
                  </p>
                  {overStock && (
                    <p className="mt-1 text-xs text-amber-700">
                      Only {line.stockQuantity} in stock — we will confirm availability
                    </p>
                  )}
                  {line.stockQuantity === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Contact for availability — we will confirm before fulfilment
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 sm:shrink-0">
                  <CartQuantityStepper
                    quantity={line.quantity}
                    min={0}
                    onDecrease={() => setPartQuantity(line.partId, line.quantity - 1)}
                    onIncrease={() => setPartQuantity(line.partId, line.quantity + 1)}
                    max={
                      line.stockQuantity > 0 ? line.stockQuantity : undefined
                    }
                  />
                  <p className="text-sm font-semibold">{formatCartPrice(lineTotal)}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => removePart(line.partId)}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}

          {!lookupDone &&
            Array.from({ length: unresolvedVehicleCount + unresolvedPartCount }).map(
              (_, i) => <CartLineSkeleton key={`skel-${i}`} />
            )}
        </ul>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" render={<Link href={ROUTES.auto.inventory} />}>
            Continue shopping — vehicles
          </Button>
          <Button variant="outline" render={<Link href={ROUTES.auto.spareParts} />}>
            Continue shopping — parts
          </Button>
        </div>

        {(vehicleItems.length > 0 || partItems.length > 0) && (
          <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-4">
            <p className="text-sm font-medium text-foreground">Remove items from cart</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose what to remove — other cart items stay until you clear them or complete checkout.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {vehicleItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => clearVehicles()}
                >
                  <Trash2 className="size-3.5" />
                  Clear all vehicles
                </Button>
              )}
              {buyVehicleItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => clearByIntent("buy")}
                >
                  <Trash2 className="size-3.5" />
                  Clear available vehicles only
                </Button>
              )}
              {preorderVehicleItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => clearByIntent("pre_order")}
                >
                  <Trash2 className="size-3.5" />
                  Clear pre-order vehicles only
                </Button>
              )}
              {partItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => clearParts()}
                >
                  <Trash2 className="size-3.5" />
                  Clear spare parts only
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmClearAll(true)}
              >
                <Trash2 className="size-3.5" />
                Clear entire cart
              </Button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmClearAll}
          onOpenChange={setConfirmClearAll}
          title="Clear entire cart?"
          description="This removes all vehicles (buy and pre-order) and spare parts from your cart. This cannot be undone."
          confirmLabel="Clear entire cart"
          destructive
          onConfirm={() => clearCart()}
        />
      </div>

      <form
        onSubmit={handleCheckout}
        className="h-fit space-y-4 rounded-xl border border-border bg-card p-6 shadow-luxury"
      >
        <h2 className="text-lg font-semibold">Checkout</h2>
        <p className="text-sm text-muted-foreground">
          {preorderVehicleLines.length > 0
            ? "Complete checkout for available items below. Pre-order vehicles are handled separately in each line item."
            : "Submit your cart for a formal quote. Our team will confirm pricing, availability, and next steps."}
        </p>

        {hasDisplayLines && (
          <div className="space-y-2 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
            {vehiclesForCheckoutSubtotal.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {lookupDone ? "Available vehicles" : "Vehicles (estimated)"}
                </span>
                <span className="font-medium">
                  {formatCartPrice(checkoutVehiclesSubtotalUsd)}
                </span>
              </div>
            )}
            {displayPartLines.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spare parts</span>
                <span className="font-medium">{formatCartPrice(partsSubtotalUsd)}</span>
              </div>
            )}
            {preorderVehicleLines.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pre-order vehicles</span>
                <span className="text-xs text-muted-foreground">Handled per item</span>
              </div>
            )}
            <div className="border-t border-brand-purple/20 pt-2">
              <p className="text-sm text-muted-foreground">Checkout total</p>
              <p className="text-2xl font-semibold text-brand-purple">
                {showCheckoutTotal ? formatCartPrice(checkoutTotalUsd) : "—"}
              </p>
              {!lookupDone && vehiclesForCheckoutSubtotal.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Verifying inventory — total may update
                </p>
              )}
              {unverifiedVehicleCount > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  {unverifiedVehicleCount}{" "}
                  {unverifiedVehicleCount === 1 ? "item" : "items"} pending
                  verification — not included in total
                </p>
              )}
            </div>
          </div>
        )}

        {hasCheckoutItems && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cart-name">Full name *</Label>
              <Input
                id="cart-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cart-email">Email *</Label>
              <Input
                id="cart-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cart-phone">Phone</Label>
              <Input
                id="cart-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cart-notes">Notes</Label>
              <Textarea
                id="cart-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Vehicle details, delivery preferences, etc."
              />
            </div>
          </>
        )}

        {feedback && (
          <p
            className={
              feedback.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"
            }
          >
            {feedback.text}
          </p>
        )}

        {hasCheckoutItems && (
          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting
              ? "Submitting…"
              : checkoutVehicleLines.length > 0 && displayPartLines.length === 0
                ? "Submit vehicle order"
                : checkoutVehicleLines.length > 0
                  ? "Submit order"
                  : "Request quote"}
          </Button>
        )}

        {!hasCheckoutItems && preorderVehicleLines.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use the pre-order prompts on each vehicle line to complete your pre-orders.
            </p>
            <CustomVehicleRequestCta variant="inline" />
          </div>
        )}
      </form>
    </div>
  );
}
