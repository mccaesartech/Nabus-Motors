import { describe, expect, it } from "vitest";
import {
  customerAvatarStoragePath,
  isSafeAvatarStoragePath,
} from "@/lib/security/avatar-path";

describe("Path traversal - avatar storage paths", () => {
  it("builds paths under the authenticated user folder only", () => {
    const path = customerAvatarStoragePath(
      "11111111-2222-3333-4444-555555555555",
      "png"
    );
    expect(path).toBe("11111111-2222-3333-4444-555555555555/avatar.png");
    expect(path.includes("..")).toBe(false);
  });

  it("strips traversal sequences from malicious user ids", () => {
    const path = customerAvatarStoragePath("../../etc/passwd", "jpg");
    expect(path).toBe("etcpasswd/avatar.jpg");
    expect(path.includes("..")).toBe(false);
    expect(path.split("/")).toHaveLength(2);
  });

  it("rejects disallowed extensions and empty ids", () => {
    expect(() => customerAvatarStoragePath("user-1", "html")).toThrow(/extension/i);
    expect(() => customerAvatarStoragePath("", "png")).toThrow(/user id/i);
  });

  it("normalizes jpeg to jpg and accepts allowlisted types", () => {
    expect(customerAvatarStoragePath("abc", "jpeg")).toBe("abc/avatar.jpg");
    expect(customerAvatarStoragePath("abc", "WEBP")).toBe("abc/avatar.webp");
  });

  it("isSafeAvatarStoragePath rejects escape attempts", () => {
    const userId = "user-abc";
    expect(isSafeAvatarStoragePath("user-abc/avatar.png", userId)).toBe(true);
    expect(isSafeAvatarStoragePath("../user-abc/avatar.png", userId)).toBe(false);
    expect(isSafeAvatarStoragePath("/user-abc/avatar.png", userId)).toBe(false);
    expect(isSafeAvatarStoragePath("user-abc\\avatar.png", userId)).toBe(false);
    expect(isSafeAvatarStoragePath("other-user/avatar.png", userId)).toBe(false);
    expect(isSafeAvatarStoragePath("user-abc/avatar.gif", userId)).toBe(false);
  });
});
