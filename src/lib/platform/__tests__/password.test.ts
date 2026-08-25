import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/platform/password";

describe("platform password hash/verify", () => {
  it("round-trips the exact create-path password string", async () => {
    const password = "TempPass-Example";
    const stored = await hashPassword(password);

    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword("TempPass-Examplex", stored)).toBe(false);
  });

  it("only the admin-allocated plaintext verifies against the stored scrypt hash", async () => {
    const allocated = "AdminAllocated-Pass99";
    const stored = await hashPassword(allocated);

    expect(await verifyPassword(allocated, stored)).toBe(true);
    expect(await verifyPassword("DifferentPassword99", stored)).toBe(false);
    expect(await verifyPassword(allocated.toLowerCase(), stored)).toBe(false);
    expect(await verifyPassword(`${allocated} `, stored)).toBe(false);
  });

  it("rejects a trimmed variant when the hashed password had padding", async () => {
    const password = "Secret12 ";
    const stored = await hashPassword(password);

    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword(password.trim(), stored)).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const password = "SamePassword99";
    const a = await hashPassword(password);
    const b = await hashPassword(password);

    expect(a).not.toBe(b);
    expect(await verifyPassword(password, a)).toBe(true);
    expect(await verifyPassword(password, b)).toBe(true);
  });
});
