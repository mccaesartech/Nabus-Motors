"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Vehicle } from "@/lib/types";

const STORAGE_KEY = "true-goshen-compare";
const COMPARE_EVENT = "true-goshen-compare-change";
export const MAX_COMPARE_VEHICLES = 4;

const EMPTY_IDS: string[] = [];

let compareSnapshot: string[] = EMPTY_IDS;
let compareSnapshotRaw: string | null = "";

function getServerCompare(): string[] {
  return EMPTY_IDS;
}

function readCompare(): string[] {
  if (typeof window === "undefined") return EMPTY_IDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === compareSnapshotRaw) return compareSnapshot;
    compareSnapshotRaw = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    compareSnapshot = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : EMPTY_IDS;
    return compareSnapshot;
  } catch {
    return EMPTY_IDS;
  }
}

function writeCompare(ids: string[]) {
  try {
    const raw = JSON.stringify(ids);
    localStorage.setItem(STORAGE_KEY, raw);
    compareSnapshotRaw = raw;
    compareSnapshot = ids;
  } catch {
    // ignore quota / private-mode errors
  }
}

function notifyCompareChange() {
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(COMPARE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COMPARE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCompare() {
  const compareIds = useSyncExternalStore(subscribe, readCompare, getServerCompare);
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const isInCompare = useCallback(
    (vehicle: Vehicle) =>
      compareIds.includes(vehicle.id) || compareIds.includes(vehicle.slug),
    [compareIds]
  );

  const addToCompare = useCallback(
    (vehicle: Vehicle): "added" | "already" | "full" => {
      if (isInCompare(vehicle)) return "already";
      const current = readCompare();
      if (current.length >= MAX_COMPARE_VEHICLES) return "full";

      const withoutLegacy = current.filter(
        (id) => id !== vehicle.id && id !== vehicle.slug
      );
      writeCompare([...withoutLegacy, vehicle.id]);
      notifyCompareChange();
      return "added";
    },
    [isInCompare]
  );

  const removeFromCompare = useCallback((vehicle: Vehicle): boolean => {
    const keys = [vehicle.id, vehicle.slug];
    const current = readCompare();
    const next = current.filter((id) => !keys.includes(id));
    if (next.length === current.length) return false;
    writeCompare(next);
    notifyCompareChange();
    return true;
  }, []);

  const toggleCompare = useCallback(
    (vehicle: Vehicle): "added" | "removed" | "full" => {
      if (isInCompare(vehicle)) {
        removeFromCompare(vehicle);
        return "removed";
      }
      const result = addToCompare(vehicle);
      if (result === "full") return "full";
      return "added";
    },
    [isInCompare, addToCompare, removeFromCompare]
  );

  const clearCompare = useCallback(() => {
    writeCompare([]);
    notifyCompareChange();
  }, []);

  return {
    compareIds,
    compareCount: compareIds.length,
    loaded,
    isInCompare,
    addToCompare,
    removeFromCompare,
    toggleCompare,
    clearCompare,
  };
}
