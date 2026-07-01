/** Platform team session cookie — Edge-safe (crypto.subtle only, no Node crypto / DB). */

export const PLATFORM_SESSION_TTL_SEC = 60 * 60 * 12;

export type PlatformSessionPayload = {
  uid: string;
  role: string;
  exp: number;
  /** Fingerprint of password_hash — invalidates session when password changes. */
  pwd: string;
};

function sessionSecret(): string {
  return process.env.ADMIN_SECRET ?? "true-goshen-admin-secret";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  const binary = atob(withPad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function passwordHashFingerprint(passwordHash: string): Promise<string> {
  return (await sha256Hex(passwordHash)).slice(0, 16);
}

/** Mint a signed session cookie value for `tg_platform_session`. */
export async function buildPlatformSessionCookieValue(
  userId: string,
  role: string,
  passwordHash: string
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + PLATFORM_SESSION_TTL_SEC;
  const pwd = await passwordHashFingerprint(passwordHash);
  const payload: PlatformSessionPayload = { uid: userId, role, exp, pwd };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = await sha256Hex(`${payloadB64}:${sessionSecret()}`);
  return `${payloadB64}.${sig}`;
}

/** Verify signature + expiry without a database call (safe for Edge middleware). */
export async function parsePlatformSessionCookieValue(
  value: string | undefined
): Promise<PlatformSessionPayload | null> {
  if (!value) return null;

  const dot = value.indexOf(".");
  if (dot <= 0) return null;

  const payloadB64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!payloadB64 || !sig) return null;

  const expectedSig = await sha256Hex(`${payloadB64}:${sessionSecret()}`);
  if (sig.length !== expectedSig.length) return null;

  // Constant-time-ish compare
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as PlatformSessionPayload;
    if (
      typeof payload.uid !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.pwd !== "string"
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** @deprecated Legacy cookie shape — kept for migration reads only. */
export function parseLegacyPlatformSessionCookie(
  value: string | undefined
): { userId: string; token: string } | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  // New cookies use base64url payloads; legacy tokens are 64-char hex.
  if (!userId || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return { userId, token };
}

/** @deprecated Use buildPlatformSessionCookieValue instead. */
export async function createPlatformSessionToken(
  userId: string,
  passwordHash: string
): Promise<string> {
  return sha256Hex(`${userId}:${passwordHash}:${sessionSecret()}`);
}
