"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

/** Cached snapshots — useSyncExternalStore requires stable references between reads. */
let garageSnapshot: GarageData = EMPTY_GARAGE;
let recentSnapshot: string[] = EMPTY_RECENT;
let garageSnapshotRaw: string | null = "";
let recentSnapshotRaw: string | null = "";

function getServerGarage(): GarageData {
  return EMPTY_GARAGE;
}

function getServerRecent(): string[] {
  return EMPTY_RECENT;
}

function normalizeGarageData(parsed: unknown): GarageData {
  if (Array.isArray(parsed)) {
    return {
      saved: parsed.filter((id): id is string => typeof id === "string"),
      prices: {},
    };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "saved" in parsed &&
    Array.isArray((parsed as GarageData).saved)
  ) {
    const data = parsed as GarageData;
    return {
      saved: data.saved.filter((id): id is string => typeof id === "string"),
      prices: data.prices && typeof data.prices === "object" ? data.prices : {},
    };
  }
  return EMPTY_GARAGE;
}

function readGarage(): GarageData {
  if (typeof window === "undefined") return EMPTY_GARAGE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === garageSnapshotRaw) return garageSnapshot;
    garageSnapshotRaw = raw;
    garageSnapshot = raw ? normalizeGarageData(JSON.parse(raw)) : EMPTY_GARAGE;
    return garageSnapshot;
  } catch {
    return EMPTY_GARAGE;
  }
}

function readRecent(): string[] {
  if (typeof window === "undefined") return EMPTY_RECENT;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw === recentSnapshotRaw) return recentSnapshot;
    recentSnapshotRaw = raw;
    recentSnapshot = raw ? JSON.parse(raw) : EMPTY_RECENT;
    return recentSnapshot;
  } catch {
    return EMPTY_RECENT;
  }
}

function writeGarage(data: GarageData) {
  try {
    const raw = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, raw);
    garageSnapshotRaw = raw;
    garageSnapshot = data;
  } catch {
    // ignore quota / private-mode errors
  }
}

function writeRecent(ids: string[]) {
  try {
    const raw = JSON.stringify(ids);
    localStorage.setItem(RECENT_KEY, raw);
    recentSnapshotRaw = raw;
    recentSnapshot = ids;
  } catch {
    // ignore quota / private-mode errors
  }
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

function resolvedKeys(vehicles: Vehicle[]): Set<string> {
  const keys = new Set<string>();
  for (const vehicle of vehicles) {
    keys.add(vehicle.id);
    keys.add(vehicle.slug);
  }
  return keys;
}

function countResolved(savedIds: string[], vehicles: Vehicle[]): number {
  if (!savedIds.length) return 0;
  const keys = resolvedKeys(vehicles);
  return savedIds.filter((id) => keys.has(id)).length;
}

export function pruneUnresolvedSaved(savedIds: string[], vehicles: Vehicle[]) {
  if (!savedIds.length) return;
  const keys = resolvedKeys(vehicles);
  const data = readGarage();
  const kept = data.saved.filter((id) => keys.has(id));
  if (kept.length === data.saved.length) return;

  const prices = { ...data.prices };
  for (const id of data.saved) {
    if (!keys.has(id)) delete prices[id];
  }
  writeGarage({ saved: kept, prices });
  notifyGarageChange();
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

  const isSavedVehicle = useCallback(
    (vehicle: Vehicle) =>
      savedIds.includes(vehicle.id) || savedIds.includes(vehicle.slug),
    [savedIds]
  );

  const removeSave = useCallback((vehicle: Vehicle): boolean => {
    const keys = [vehicle.id, vehicle.slug];
    const data = readGarage();
    const nextSaved = data.saved.filter((id) => !keys.includes(id));
    if (nextSaved.length === data.saved.length) return false;

    const prices = { ...data.prices };
    for (const key of keys) {
      delete prices[key];
    }
    writeGarage({ saved: nextSaved, prices });
    notifyGarageChange();
    return true;
  }, []);

  const toggleSave = useCallback((vehicle: Vehicle): "saved" | "removed" => {
    if (isSavedVehicle(vehicle)) {
      removeSave(vehicle);
      return "removed";
    }

    const data = readGarage();
    const withoutLegacy = data.saved.filter(
      (id) => id !== vehicle.id && id !== vehicle.slug
    );
    writeGarage({
      saved: [...withoutLegacy, vehicle.id],
      prices: { ...data.prices, [vehicle.id]: vehicle.price },
    });
    notifyGarageChange();
    return "saved";
  }, [isSavedVehicle, removeSave]);

  const clearSaved = useCallback(() => {
    writeGarage({ saved: [], prices: {} });
    notifyGarageChange();
  }, []);

  const addRecent = useCallback((id: string) => {
    const prev = readRecent();
    const updated = [id, ...prev.filter((i) => i !== id)].slice(0, 8);
    if (
      updated.length === prev.length &&
      updated.every((value, index) => value === prev[index])
    ) {
      return;
    }
    writeRecent(updated);
    notifyGarageChange();
  }, []);

  return {
    savedIds,
    savedCount: savedIds.length,
    priceMap,
    recentIds,
    loaded,
    isSaved,
    isSavedVehicle,
    toggleSave,
    removeSave,
    clearSaved,
    addRecent,
  };
}

/** Header badge count — only IDs that resolve to a vehicle in lookup. */
export function useSavedVehicleCount() {
  const { savedIds, loaded } = useGarage();
  const { vehicles, loaded: vehiclesLoaded } = useGarageVehicles(savedIds, savedIds);

  const savedCount = useMemo(() => {
    if (!vehiclesLoaded) return 0;
    return countResolved(savedIds, vehicles);
  }, [savedIds, vehicles, vehiclesLoaded]);

  return { savedCount, loaded: loaded && vehiclesLoaded };
}

export function useGarageVehicles(ids: string[], savedIdsToPrune?: string[]) {
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
      .then((res) => {
        if (!res.ok) throw new Error("lookup failed");
        return res.json();
      })
      .then((data: { vehicles: Vehicle[] }) => {
        if (cancelled) return;
        const vehicles = data.vehicles ?? [];
        if (savedIdsToPrune?.length) {
          pruneUnresolvedSaved(savedIdsToPrune, vehicles);
        }
        setResult({ vehicles, key: idKey });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ vehicles: [], key: idKey });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loaded, idKey, ids.length, savedIdsToPrune]);

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

export function buildVehicleLookupMap(vehicles: Vehicle[]): Map<string, Vehicle> {
  const map = new Map<string, Vehicle>();
  for (const vehicle of vehicles) {
    map.set(vehicle.id, vehicle);
    map.set(vehicle.slug, vehicle);
  }
  return map;
}
