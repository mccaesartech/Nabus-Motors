import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPublicSiteUrl } from "@/lib/site-url";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type WebAuthnChallengeType = "registration" | "authentication";

export function isWebAuthnEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WEBAUTHN_ENABLED === "true";
}

export function getWebAuthnRpId(): string {
  const explicit = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicit) return explicit;

  try {
    return new URL(getPublicSiteUrl()).hostname;
  } catch {
    return "localhost";
  }
}

export function getWebAuthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME?.trim() || "Nabus Motors Admin";
}

export function getExpectedOrigins(requestOrigin?: string | null): string[] {
  const origins = new Set<string>();

  const siteUrl = getPublicSiteUrl();
  try {
    origins.add(new URL(siteUrl).origin);
  } catch {
    /* ignore */
  }

  if (requestOrigin) {
    try {
      origins.add(new URL(requestOrigin).origin);
    } catch {
      /* ignore */
    }
  }

  if (process.env.NODE_ENV === "development") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    try {
      origins.add(new URL(`https://${vercelUrl}`).origin);
    } catch {
      /* ignore */
    }
  }

  return [...origins];
}

function userIdToBytes(userId: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(new TextEncoder().encode(userId));
}

export async function cleanupExpiredChallenges(): Promise<void> {
  const supabase = createAdminSupabase();
  if (!supabase) return;
  await supabase
    .from("platform_webauthn_challenges")
    .delete()
    .lt("expires_at", new Date().toISOString());
}

export async function storeChallenge(
  challenge: string,
  type: WebAuthnChallengeType,
  platformUserId?: string | null
): Promise<void> {
  const supabase = createAdminSupabase();
  if (!supabase) throw new Error("Database not configured.");

  await cleanupExpiredChallenges();

  const { error } = await supabase.from("platform_webauthn_challenges").insert({
    challenge,
    type,
    platform_user_id: platformUserId ?? null,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });

  if (error) throw new Error(error.message);
}

export async function consumeChallenge(
  challenge: string,
  type: WebAuthnChallengeType,
  platformUserId?: string | null
): Promise<boolean> {
  const supabase = createAdminSupabase();
  if (!supabase) return false;

  await cleanupExpiredChallenges();

  let query = supabase
    .from("platform_webauthn_challenges")
    .select("challenge, platform_user_id")
    .eq("challenge", challenge)
    .eq("type", type)
    .gt("expires_at", new Date().toISOString());

  if (platformUserId) {
    query = query.eq("platform_user_id", platformUserId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return false;

  await supabase.from("platform_webauthn_challenges").delete().eq("challenge", challenge);
  return true;
}

export function challengeVerifier(
  type: WebAuthnChallengeType,
  platformUserId?: string | null
) {
  return async (challenge: string) =>
    consumeChallenge(challenge, type, platformUserId ?? undefined);
}

type PasskeyRow = {
  id: string;
  platform_user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string | null;
  transports: string[] | null;
  created_at: string;
  last_used_at: string | null;
};

export type SafePasskey = {
  id: string;
  deviceName: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export function toWebAuthnCredential(row: PasskeyRow): WebAuthnCredential {
  return {
    id: row.credential_id,
    publicKey: isoBase64URL.toBuffer(row.public_key),
    counter: Number(row.counter),
    transports: (row.transports ?? []) as AuthenticatorTransportFuture[],
  };
}

export async function listUserPasskeys(platformUserId: string): Promise<SafePasskey[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("platform_user_passkeys")
    .select("id, device_name, transports, created_at, last_used_at")
    .eq("platform_user_id", platformUserId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    deviceName: row.device_name,
    transports: row.transports ?? [],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function createRegistrationOptionsForUser(
  platformUserId: string,
  email: string,
  displayName: string,
  requestOrigin?: string | null
) {
  const supabase = createAdminSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const { data: existing } = await supabase
    .from("platform_user_passkeys")
    .select("credential_id, transports")
    .eq("platform_user_id", platformUserId);

  const options = await generateRegistrationOptions({
    rpName: getWebAuthnRpName(),
    rpID: getWebAuthnRpId(),
    userName: email,
    userDisplayName: displayName,
    userID: new Uint8Array(userIdToBytes(platformUserId)),
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((cred) => ({
      id: cred.credential_id,
      transports: (cred.transports ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await storeChallenge(options.challenge, "registration", platformUserId);
  return { options, expectedOrigins: getExpectedOrigins(requestOrigin) };
}

export async function verifyRegistrationForUser(
  platformUserId: string,
  response: RegistrationResponseJSON,
  deviceName: string | null,
  requestOrigin?: string | null
) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeVerifier("registration", platformUserId),
    expectedOrigin: getExpectedOrigins(requestOrigin),
    expectedRPID: getWebAuthnRpId(),
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration could not be verified.");
  }

  const { credential } = verification.registrationInfo;
  const supabase = createAdminSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const { error } = await supabase.from("platform_user_passkeys").insert({
    platform_user_id: platformUserId,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    device_name: deviceName?.trim() || null,
    transports: credential.transports ?? [],
  });

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      throw new Error("This passkey is already registered.");
    }
    throw new Error(error.message);
  }

  return { credentialId: credential.id };
}

export async function createAuthenticationOptionsForLogin(
  email?: string | null,
  requestOrigin?: string | null
) {
  const supabase = createAdminSupabase();
  if (!supabase) throw new Error("Database not configured.");

  let platformUserId: string | null = null;
  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: user } = await supabase
      .from("platform_users")
      .select("id, status")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!user || user.status !== "active") {
      throw new Error("No active account found for that email.");
    }

    platformUserId = user.id;

    const { data: passkeys } = await supabase
      .from("platform_user_passkeys")
      .select("credential_id, transports")
      .eq("platform_user_id", user.id);

    if (!passkeys?.length) {
      throw new Error("No passkeys registered for this account. Sign in with your password first.");
    }

    allowCredentials = passkeys.map((pk) => ({
      id: pk.credential_id,
      transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(),
    allowCredentials,
    userVerification: "preferred",
  });

  await storeChallenge(options.challenge, "authentication", platformUserId);
  return { options, platformUserId, expectedOrigins: getExpectedOrigins(requestOrigin) };
}

export async function verifyAuthenticationForLogin(
  response: AuthenticationResponseJSON,
  expectedPlatformUserId: string | null,
  requestOrigin?: string | null
) {
  const supabase = createAdminSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const { data: passkey, error } = await supabase
    .from("platform_user_passkeys")
    .select("*")
    .eq("credential_id", response.id)
    .maybeSingle();

  if (error || !passkey) {
    throw new Error("Passkey not recognized.");
  }

  if (expectedPlatformUserId && passkey.platform_user_id !== expectedPlatformUserId) {
    throw new Error("Passkey does not match this account.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeVerifier("authentication", passkey.platform_user_id),
    expectedOrigin: getExpectedOrigins(requestOrigin),
    expectedRPID: getWebAuthnRpId(),
    credential: toWebAuthnCredential(passkey as PasskeyRow),
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error("Passkey verification failed.");
  }

  const newCounter = verification.authenticationInfo.newCounter;
  if (newCounter <= Number(passkey.counter)) {
    throw new Error("Passkey counter replay detected. This passkey has been blocked.");
  }

  const now = new Date().toISOString();
  await supabase
    .from("platform_user_passkeys")
    .update({ counter: newCounter, last_used_at: now })
    .eq("id", passkey.id);

  const { data: user } = await supabase
    .from("platform_users")
    .select("id, name, email, role, status, password_hash")
    .eq("id", passkey.platform_user_id)
    .maybeSingle();

  if (!user || user.status !== "active" || !user.password_hash) {
    throw new Error("Account is not active or missing a password.");
  }

  await supabase
    .from("platform_users")
    .update({ last_login_at: now })
    .eq("id", user.id);

  return user;
}

export async function deleteUserPasskey(platformUserId: string, passkeyId: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  if (!supabase) return false;

  const { error, count } = await supabase
    .from("platform_user_passkeys")
    .delete({ count: "exact" })
    .eq("id", passkeyId)
    .eq("platform_user_id", platformUserId);

  return !error && (count ?? 0) > 0;
}

export async function countUnusedBackupCodes(platformUserId: string): Promise<number> {
  const supabase = createAdminSupabase();
  if (!supabase) return 0;

  const { count } = await supabase
    .from("platform_user_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("platform_user_id", platformUserId)
    .is("used_at", null);

  return count ?? 0;
}
