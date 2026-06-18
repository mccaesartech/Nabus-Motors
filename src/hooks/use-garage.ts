"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Vehicle } from "@/lib/types";

const STORAGE_KEY = "true-goshen-garage";
const RECENT_KEY = "true-goshen-recent";
const GARAGE_EVENT = "true-goshen-garage-change";

interface GarageData {
  saved: string[];
  prices: Record<string, number>;
}

function readGarage(): GarageData {
  if (typeof window === "undefined") return { saved: [], prices: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { saved: [], prices: {} };
  } catch {
    return { saved: [], prices: {} };
  }
}

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const recent = localStorage.getItem(RECENT_KEY);
    return recent ? JSON.parse(recent) : [];
  } catch {
    return [];
  }
}

function writeGarage(data: GarageData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function notifyGarageChange() {
  window.dispatchEvent(new Event(GARAGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(GARAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(GARAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function useGarage() {
  const hydrated = useHydrated();
  const garage = useSyncExternalStore(
    subscribe,
    readGarage,
    () => ({ saved: [], prices: {} })
  );
  const recentIds = useSyncExternalStore(subscribe, readRecent, () => []);

  const savedIds = garage.saved;
  const priceMap = garage.prices;

  const isSaved = useCallback(
    (id: string) => savedIds.includes(id),
    [savedIds]
  );

  const toggleSave = useCallback((vehicle: Vehicle) => {
    const data = readGarage();
    const exists = data.saved.includes(vehicle.id);
    if (exists) {
      data.saved = data.saved.filter((id) => id !== vehicle.id);
      delete data.prices[vehicle.id];
    } else {
      data.saved = [...data.saved, vehicle.id];
      data.prices[vehicle.id] = vehicle.price;
    }
    writeGarage(data);
    notifyGarageChange();
  }, []);

  const addRecent = useCallback((id: string) => {
    const prev = readRecent();
    const updated = [id, ...prev.filter((i) => i !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    notifyGarageChange();
  }, []);

  return {
    savedIds,
    savedCount: savedIds.length,
    priceMap,
    recentIds,
    loaded: hydrated,
    isSaved,
    toggleSave,
    addRecent,
  };
}

export function useGarageVehicles(ids: string[]) {
  const { loaded } = useGarage();
  const [result, setResult] = useState<{ vehicles: Vehicle[]; key: string }>({
    vehicles: [],
    key: "",
  });

  const idKey = ids.join(",");

  useEffect(() => {
    if (!loaded || ids.length === 0) return;

    let cancelled = false;

    fetch(`/api/vehicles/lookup?ids=${encodeURIComponent(idKey)}`)
      .then((res) => res.json())
      .then((data: { vehicles: Vehicle[] }) => {
        if (!cancelled) {
          setResult({ vehicles: data.vehicles, key: idKey });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ vehicles: [], key: idKey });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loaded, idKey, ids.length]);

  const vehiclesLoaded =
    loaded && (ids.length === 0 || result.key === idKey);
  const vehicles =
    ids.length === 0
      ? []
      : result.key === idKey
        ? result.vehicles
        : [];

  return { vehicles, loaded: vehiclesLoaded };
}
