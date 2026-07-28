import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  allowPlatformPublicExit,
  armPlatformHistoryGuard,
  clearPlatformHistoryGuard,
  getPlatformHistoryBounceTarget,
  getPlatformHistoryReturnPath,
  rememberPlatformHistoryPath,
} from "@/lib/platform/history-guard";
import { platformDashboardPath, platformPath } from "@/lib/platform/paths";

function installMemorySessionStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memory,
  });
}

describe("platform history guard", () => {
  beforeEach(() => {
    installMemorySessionStorage();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("arms and remembers the last platform path", () => {
    const inventory = platformPath("inventory");
    armPlatformHistoryGuard(platformDashboardPath());
    rememberPlatformHistoryPath(inventory);

    expect(getPlatformHistoryReturnPath()).toBe(inventory);
    expect(getPlatformHistoryBounceTarget(inventory)).toBeNull();
    expect(getPlatformHistoryBounceTarget(platformDashboardPath())).toBeNull();
  });

  it("bounces accidental public landings back into platform", () => {
    const inventory = platformPath("inventory");
    armPlatformHistoryGuard(inventory);

    expect(getPlatformHistoryBounceTarget("/")).toBe(inventory);
    expect(getPlatformHistoryBounceTarget("/auto/inventory")).toBe(inventory);
  });

  it("bounces accidental Back onto the admin login while armed", () => {
    armPlatformHistoryGuard(platformDashboardPath());
    expect(getPlatformHistoryBounceTarget(adminLoginPath())).toBe(
      platformDashboardPath()
    );
  });

  it("does not bounce after an explicit public exit", () => {
    armPlatformHistoryGuard(platformDashboardPath());
    allowPlatformPublicExit();

    expect(getPlatformHistoryBounceTarget("/")).toBeNull();
  });

  it("does not bounce after clear (logout / login shell)", () => {
    armPlatformHistoryGuard(platformDashboardPath());
    clearPlatformHistoryGuard();

    expect(getPlatformHistoryBounceTarget("/")).toBeNull();
    expect(getPlatformHistoryReturnPath()).toBe(platformDashboardPath());
  });

  it("ignores unsafe return paths", () => {
    armPlatformHistoryGuard(platformDashboardPath());
    rememberPlatformHistoryPath("//evil.example");
    rememberPlatformHistoryPath("/auto/inventory");

    expect(getPlatformHistoryReturnPath()).toBe(platformDashboardPath());
  });
});
