"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Vehicle } from "@/lib/types";

const STORAGE_KEY = "true-goshen-garage";
const RECENT_KEY = "true-goshen-recent";

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

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useGarage() {
  const garage = useSyncExternalStore(
    subscribe,
    readGarage,
    () => ({ saved: [], prices: {} })
  );
  const recentIds = useSyncExternalStore(subscribe, readRecent, () => []);

  const savedIds = garage.saved;
  const priceMap = garage.prices;
  const loaded = typeof window !== "undefined";

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
    window.dispatchEvent(new Event("storage"));
  }, []);

  const addRecent = useCallback((id: string) => {
    const prev = readRecent();
    const updated = [id, ...prev.filter((i) => i !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
  }, []);

  return {
    savedIds,
    savedCount: savedIds.length,
    priceMap,
    recentIds,
    loaded,
    isSaved,
    toggleSave,
    addRecent,
  };
}
