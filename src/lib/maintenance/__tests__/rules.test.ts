import { describe, expect, it } from "vitest";
import {
  isApiPath,
  isMaintenanceExemptPath,
  shouldBlockRequest,
} from "@/lib/maintenance/rules";

describe("shouldBlockRequest", () => {
  it("never blocks when maintenance is off", () => {
    expect(shouldBlockRequest("/", false, false)).toBe(false);
    expect(shouldBlockRequest("/auto/inventory", false, false)).toBe(false);
    expect(shouldBlockRequest("/api/vehicles", false, false)).toBe(false);
  });

  it("never blocks authenticated platform admins", () => {
    expect(shouldBlockRequest("/", true, true)).toBe(false);
    expect(shouldBlockRequest("/auto/buy", true, true)).toBe(false);
    expect(shouldBlockRequest("/api/inquiries", true, true)).toBe(false);
    expect(shouldBlockRequest("/account", true, true)).toBe(false);
  });

  it("blocks customers and anonymous visitors on public pages", () => {
    expect(shouldBlockRequest("/", false, true)).toBe(true);
    expect(shouldBlockRequest("/auto/inventory", false, true)).toBe(true);
    expect(shouldBlockRequest("/contact", false, true)).toBe(true);
    expect(shouldBlockRequest("/account/settings", false, true)).toBe(true);
  });

  it("blocks public/customer APIs for non-admins", () => {
    expect(shouldBlockRequest("/api/vehicles", false, true)).toBe(true);
    expect(shouldBlockRequest("/api/inquiries", false, true)).toBe(true);
    expect(shouldBlockRequest("/api/customer/profile", false, true)).toBe(true);
    expect(shouldBlockRequest("/api/settings/public", false, true)).toBe(true);
  });

  it("allows exempt paths even for anonymous visitors", () => {
    const exempt = [
      "/maintenance",
      "/admin",
      "/admin/dashboard",
      "/platform/dashboard",
      "/platform/settings",
      "/api/admin/settings",
      "/api/admin/login",
      "/api/cron/whatsapp-retry",
      "/api/health/live",
      "/api/health/ready",
      "/api/whatsapp/webhook",
      "/auth/callback",
      "/favicon.ico",
      "/manifest.webmanifest",
      "/_next/static/chunks/main.js",
      "/icons/icon-192.png",
    ];
    for (const path of exempt) {
      expect(shouldBlockRequest(path, false, true), path).toBe(false);
      expect(isMaintenanceExemptPath(path), path).toBe(true);
    }
  });
});

describe("isApiPath", () => {
  it("detects API routes", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/vehicles")).toBe(true);
    expect(isApiPath("/auto")).toBe(false);
    expect(isApiPath("/maintenance")).toBe(false);
  });
});
