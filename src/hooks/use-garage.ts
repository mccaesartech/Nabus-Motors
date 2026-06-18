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

const EMPTY_GARAGE: GarageData = { saved: [], prices: {} };
const EMPTY_RECENT: string[] = [];

function getServerGarage(): GarageData {
  return EMPTY_GARAGE;
}

function getServerRecent(): string[] {
  return EMPTY_RECENT;
}

function readGarage(): GarageData {
  if (typeof window === "undefined") return EMPTY_GARAGE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : EMPTY_GARAGE;
  } catch {
    return EMPTY_GARAGE;
  }
}

function readRecent(): string[] {
  if (typeof window === "undefined") return EMPTY_RECENT;
  try {
    const recent = localStorage.getItem(RECENT_KEY);
    return recent ? JSON.parse(recent) : EMPTY_RECENT;
  } catch {
    return EMPTY_RECENT;
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

export function useGarage() {
  const garage = useSyncExternalStore(subscribe, readGarage, getServerGarage);
  const recentIds = useSyncExternalStore(subscribe, readRecent, getServerRecent);
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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
    loaded,
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
