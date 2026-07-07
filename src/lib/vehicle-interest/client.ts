/** Client-side vehicle interest tracking — queues for guests, syncs on login. */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";
import type { PendingVehicleInterest, VehicleInterestActivityType } from "./types";

export const VEHICLE_INTEREST_PENDING_KEY = "true-goshen-vehicle-interest-pending";
const VIEW_SESSION_PREFIX = "true-goshen-vehicle-view-";

function readPending(): PendingVehicleInterest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VEHICLE_INTEREST_PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingVehicleInterest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(rows: PendingVehicleInterest[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VEHICLE_INTEREST_PENDING_KEY, JSON.stringify(rows.slice(0, 100)));
  } catch {
    // ignore
  }
}

function queuePending(row: PendingVehicleInterest) {
  const pending = readPending();
  pending.unshift(row);
  writePending(pending);
}

function shouldSkipView(vehicleId: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `${VIEW_SESSION_PREFIX}${vehicleId}`;
  if (sessionStorage.getItem(key)) return true;
  sessionStorage.setItem(key, "1");
  return false;
}

export function clearPendingVehicleInterest() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VEHICLE_INTEREST_PENDING_KEY);
  } catch {
    // ignore
  }
}

export function readPendingVehicleInterest(): PendingVehicleInterest[] {
  return readPending();
}

type TrackOptions = {
  email?: string | null;
  phone?: string | null;
  accessToken?: string | null;
};

export function trackVehicleInterest(
  activityType: VehicleInterestActivityType,
  vehicle: Pick<Vehicle, "id">,
  options?: TrackOptions
) {
  if (typeof window === "undefined") return;
  if (activityType === "view" && shouldSkipView(vehicle.id)) return;

  const payload = {
    vehicle_id: vehicle.id,
    activity_type: activityType,
    email: options?.email ?? null,
    phone: options?.phone ?? null,
  };

  void (async () => {
    let accessToken = options?.accessToken ?? null;
    if (!accessToken && isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;
    }

    if (!accessToken) {
      queuePending({
        ...payload,
        created_at: new Date().toISOString(),
      });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    fetch("/api/vehicle/activity", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {
      // non-blocking
    });
  })();
}

export async function syncVehicleInterestOnLogin(
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  const pending = readPending();
  if (!pending.length) return;

  try {
    const res = await fetch("/api/customer/sync-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vehicleInterestPending: pending }),
    });
    if (res.ok) {
      clearPendingVehicleInterest();
    }
  } catch {
    // non-blocking
  }
}
