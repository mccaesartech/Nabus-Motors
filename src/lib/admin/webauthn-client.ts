"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

export function isBrowserWebAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof window.PublicKeyCredential === "function"
  );
}

export function isWebAuthnFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WEBAUTHN_ENABLED === "true";
}

export async function registerPasskey(deviceName?: string): Promise<{ ok: boolean; message: string }> {
  const optionsRes = await fetch("/api/admin/passkeys/register/options", {
    method: "POST",
    credentials: "same-origin",
  });
  const optionsJson = await optionsRes.json();
  if (!optionsRes.ok || !optionsJson.ok) {
    return { ok: false, message: optionsJson.message ?? "Could not start passkey registration." };
  }

  const attestation = await startRegistration({
    optionsJSON: optionsJson.options as PublicKeyCredentialCreationOptionsJSON,
  });

  const verifyRes = await fetch("/api/admin/passkeys/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ response: attestation, deviceName: deviceName?.trim() || null }),
  });
  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok || !verifyJson.ok) {
    return { ok: false, message: verifyJson.message ?? "Passkey registration failed." };
  }

  return { ok: true, message: verifyJson.message ?? "Passkey registered." };
}

export async function loginWithPasskey(email?: string): Promise<{
  ok: boolean;
  message?: string;
  redirect?: string;
}> {
  const optionsRes = await fetch("/api/admin/passkeys/login/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email: email?.trim().toLowerCase() || undefined }),
  });
  const optionsJson = await optionsRes.json();
  if (!optionsRes.ok || !optionsJson.ok) {
    return { ok: false, message: optionsJson.message ?? "Could not start passkey sign-in." };
  }

  const assertion = await startAuthentication({
    optionsJSON: optionsJson.options as PublicKeyCredentialRequestOptionsJSON,
  });

  const verifyRes = await fetch("/api/admin/passkeys/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      response: assertion as AuthenticationResponseJSON,
      platformUserId: optionsJson.platformUserId ?? null,
    }),
  });
  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok || !verifyJson.ok) {
    return { ok: false, message: verifyJson.message ?? "Passkey sign-in failed." };
  }

  return { ok: true, redirect: verifyJson.redirect };
}

export async function loginWithBackupCode(
  email: string,
  code: string
): Promise<{ ok: boolean; message?: string; redirect?: string }> {
  const res = await fetch("/api/admin/backup-codes/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    return { ok: false, message: json.message ?? "Backup code sign-in failed." };
  }
  return { ok: true, redirect: json.redirect };
}
