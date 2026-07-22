import { describe, expect, it } from "vitest";
import {
  isAdminAppPath,
  isAdminPlatformPath,
  isAdminPwaInstallPath,
} from "@/lib/pwa/routes";

describe("platform PWA routes", () => {
  it.each([
    "/admin",
    "/admin/",
    "/admin/platform",
    "/admin/platform/dashboard",
    "/admin/platform/inventory/vehicle-1/edit",
    "/admin/platform/settings",
  ])("allows the platform web app to be installed from %s", (pathname) => {
    expect(isAdminPwaInstallPath(pathname)).toBe(true);
  });

  it.each(["/", "/vehicles", "/platform/dashboard", "/administrator"])(
    "does not expose the platform install flow on %s",
    (pathname) => {
      expect(isAdminPwaInstallPath(pathname)).toBe(false);
    }
  );

  it("keeps platform routes within the admin PWA scope", () => {
    const pathname = "/admin/platform/dashboard";

    expect(isAdminAppPath(pathname)).toBe(true);
    expect(isAdminPlatformPath(pathname)).toBe(true);
  });
});
