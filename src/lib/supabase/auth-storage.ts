import type { SupportedStorage } from "@supabase/supabase-js";
import {
  getSessionPreference,
  type SessionPreference,
} from "@/lib/customer/session-preference";
import { getSupabaseUrl } from "./env";

const memoryStore = new Map<string, string>();

export const memoryAuthStorage: SupportedStorage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

function noopStorage(): SupportedStorage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function storageForPreference(preference: SessionPreference | null): SupportedStorage {
  if (typeof window === "undefined") return noopStorage();
  if (preference === "stay_signed_in") return localStorage;
  if (preference === "no_save") return memoryAuthStorage;
  return sessionStorage;
}

export function getSupabaseAuthStorageKey(): string {
  const url = getSupabaseUrl() ?? "";
  const ref = url.match(/https:\/\/([^.]+)\./)?.[1] ?? "auth";
  return `sb-${ref}-auth-token`;
}

export function clearSupabaseAuthFromAllStorages(): void {
  if (typeof window === "undefined") return;
  const key = getSupabaseAuthStorageKey();
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  memoryAuthStorage.removeItem(key);
}

/** Routes Supabase session tokens to localStorage, sessionStorage, or memory by preference. */
export function createPreferenceAwareAuthStorage(): SupportedStorage {
  return {
    getItem: (key) => storageForPreference(getSessionPreference()).getItem(key),
    setItem: (key, value) => storageForPreference(getSessionPreference()).setItem(key, value),
    removeItem: (key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      memoryAuthStorage.removeItem(key);
    },
  };
}
