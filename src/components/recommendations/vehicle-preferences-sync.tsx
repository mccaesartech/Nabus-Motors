"use client";

import { useEffect } from "react";
import { useCustomerAuth } from "@/context/customer-auth-context";
import {
  loadVehiclePreferencesFromProfile,
  syncVehiclePreferencesToProfile,
} from "@/lib/vehicle-preferences";

/** Merges local preference profile with server on login; syncs local changes when authenticated. */
export function VehiclePreferencesSync() {
  const { user, getAccessToken } = useCustomerAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      await loadVehiclePreferencesFromProfile(getAccessToken);
      if (cancelled) return;
      await syncVehiclePreferencesToProfile(getAccessToken);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken]);

  return null;
}
