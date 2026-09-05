"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Package,
  Search,
  Ship,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useGarage } from "@/hooks/use-garage";
import { usePartsCartCount } from "@/context/parts-cart-context";
import {
  getLastInventorySearch,
  getLastTracking,
  hasAppointmentBookedFlag,
  subscribeJourneyHistory,
} from "@/lib/journey-history";
import {
  hasMeaningfulPreferences,
  readVehiclePreferences,
} from "@/lib/vehicle-preferences";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type ContinueItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

function useJourneyHistoryVersion() {
  return useSyncExternalStore(
    subscribeJourneyHistory,
    () => {
      const parts = [
        getLastInventorySearch(),
        getLastTracking()?.number ?? "",
        hasAppointmentBookedFlag() ? "1" : "0",
        readVehiclePreferences().updatedAt,
      ];
      return parts.join("|");
    },
    () => ""
  );
}

export function ContinueYourJourney() {
  const { savedIds, recentIds, loaded: garageLoaded } = useGarage();
  const { cartCount, loaded: cartLoaded } = usePartsCartCount();
  const { user, getAccessToken } = useCustomerAuth();
  const historyVersion = useJourneyHistoryVersion();

  const [hasAppointments, setHasAppointments] = useState(false);
  const [hasShipments, setHasShipments] = useState(false);
  const [hasFreightQuotes, setHasFreightQuotes] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasAppointments(false);
      setHasShipments(false);
      setHasFreightQuotes(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;

        const headers = { Authorization: `Bearer ${token}` };
        const [appointmentsRes, trackingRes] = await Promise.all([
          fetch("/api/customer/appointments", { headers }),
          fetch("/api/customer/tracking", { headers }),
        ]);

        if (cancelled) return;

        if (appointmentsRes.ok) {
          const json = await appointmentsRes.json();
          const appointments = json.appointments ?? [];
          setHasAppointments(appointments.length > 0);
        }

        if (trackingRes.ok) {
          const json = await trackingRes.json();
          const shipments = json.shipments ?? [];
          const quotes = json.quotes ?? [];
          setHasShipments(Array.isArray(shipments) && shipments.length > 0);
          setHasFreightQuotes(Array.isArray(quotes) && quotes.length > 0);
        }
      } catch {
        if (!cancelled) {
          setHasAppointments(false);
          setHasShipments(false);
          setHasFreightQuotes(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken, historyVersion]);

  const items = useMemo(() => {
    if (!garageLoaded || !cartLoaded) return [];

    const next: ContinueItem[] = [];
    const lastSearch = getLastInventorySearch();

    if (lastSearch) {
      next.push({
        id: "vehicle-search",
        label: "Continue Vehicle Search",
        href: lastSearch,
        icon: Search,
      });
    } else if (recentIds.length > 0) {
      next.push({
        id: "vehicle-search",
        label: "Continue Vehicle Search",
        href: ROUTES.auto.inventory,
        icon: Search,
      });
    }

    const lastTracking = getLastTracking();
    if (lastTracking) {
      const query =
        lastTracking.mode === "reference"
          ? `reference=${encodeURIComponent(lastTracking.number)}`
          : `tracking=${encodeURIComponent(lastTracking.number)}`;
      next.push({
        id: "shipment-tracking",
        label: "Continue Shipment Tracking",
        href: `${ROUTES.corporate.freightTracking}?${query}`,
        icon: Truck,
      });
    } else if (hasShipments) {
      next.push({
        id: "shipment-tracking",
        label: "Continue Shipment Tracking",
        href: `${ROUTES.corporate.account}#shipment-tracking`,
        icon: Truck,
      });
    }

    if (savedIds.length > 0) {
      next.push({
        id: "saved-vehicles",
        label: "View Saved Vehicles",
        href: ROUTES.auto.garage,
        icon: Car,
      });
    }

    if (hasMeaningfulPreferences(readVehiclePreferences())) {
      next.push({
        id: "recommended-vehicles",
        label: "View Recommended Vehicles",
        href: ROUTES.auto.inventory,
        icon: Sparkles,
      });
    }

    if (hasFreightQuotes) {
      next.push({
        id: "freight-request",
        label: "Continue Freight Request",
        href: `${ROUTES.corporate.freight}#request-quote`,
        icon: Ship,
      });
    }

    if (cartCount > 0) {
      next.push({
        id: "spare-parts-order",
        label: "Shop spare parts",
        href: ROUTES.auto.spareParts,
        icon: Package,
      });
    }

    if (hasAppointments || hasAppointmentBookedFlag()) {
      next.push({
        id: "appointment",
        label: "Book Another Appointment",
        href: ROUTES.corporate.appointments,
        icon: CalendarCheck,
      });
    }

    return next;
  }, [
    garageLoaded,
    cartLoaded,
    recentIds,
    savedIds,
    cartCount,
    hasAppointments,
    hasShipments,
    hasFreightQuotes,
    historyVersion,
  ]);

  if (items.length === 0) return null;

  return (
    <div className="mb-10 rounded-sm border border-brand-auto-accent/20 bg-brand-surface p-4 sm:mb-12 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-auto-accent">
        Continue Your Journey
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-brand-auto-accent/40 hover:bg-brand-auto-accent/5"
              )}
            >
              <Icon className="size-4 text-brand-auto-accent" strokeWidth={2} />
              {item.label}
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
