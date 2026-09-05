"use client";

import { useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { adminDashboardPath, adminLoginPath } from "@/lib/admin/paths";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  isBrowserWebAuthnAvailable,
  isWebAuthnFeatureEnabled,
  loginWithBackupCode,
  loginWithPasskey,
} from "@/lib/admin/webauthn-client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerLogin, setOwnerLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  const passkeysEnabled = isWebAuthnFeatureEnabled();
  const webAuthnAvailable = isBrowserWebAuthnAvailable();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: ownerLogin ? "" : email.trim().toLowerCase(),
        password,
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.message ?? "Login failed.");
      setLoading(false);
      return;
    }

    // replace — avoid leaving public UI / login under the Back stack
    window.location.replace(data.redirect ?? adminDashboardPath());
  }

  async function handlePasskeyLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email above before signing in with a passkey.");
      return;
    }

    if (!webAuthnAvailable) {
      setError("Passkeys are not supported in this browser.");
      return;
    }

    setPasskeyLoading(true);
    setError("");

    try {
      const result = await loginWithPasskey(normalizedEmail);
      if (result.ok) {
        window.location.replace(result.redirect ?? adminDashboardPath());
        return;
      }
      setError(result.message ?? "Passkey sign-in failed.");
    } catch {
      setError("Passkey sign-in was cancelled or failed. Try your password instead.");
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handleBackupCodeLogin(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !backupCode.trim()) {
      setError("Email and backup code are required.");
      return;
    }

    setPasskeyLoading(true);
    setError("");

    const result = await loginWithBackupCode(normalizedEmail, backupCode);
    if (result.ok) {
      window.location.replace(result.redirect ?? adminDashboardPath());
      return;
    }

    setError(result.message ?? "Backup code sign-in failed.");
    setPasskeyLoading(false);
  }

  return (
    <AdminAuthShell>
      <div className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] p-5 shadow-lg sm:p-8">
        <h1 className="text-center text-xl font-semibold text-[var(--platform-text)]">
          Admin Portal
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--platform-text-secondary)]">
          Team members: enter your email and password. Owner: use master password only (no email).
          New invites must be activated from the invitation link, not this form.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        >
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2.5 text-sm text-[var(--platform-text-secondary)]">
            <input
              type="checkbox"
              checked={ownerLogin}
              onChange={(e) => {
                const checked = e.target.checked;
                setOwnerLogin(checked);
                if (checked) setEmail("");
                setError("");
              }}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-[var(--platform-text)]">Owner sign-in</span>
              <span className="mt-0.5 block text-xs">
                Uses the server master password only. Clears email so autofill cannot route you to team login.
              </span>
            </span>
          </label>
          {!ownerLogin ? (
            <div className="space-y-1.5">
              <Label htmlFor="admin-portal-email">Email (team members)</Label>
              <input
                id="admin-portal-email"
                name="admin-portal-email"
                type="text"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="platform-input w-full"
                placeholder="you@company.com"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="admin-portal-password">Password</Label>
            <PasswordInput
              id="admin-portal-password"
              name="admin-portal-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="platform-input"
            />
            <p className="text-right text-xs">
              <Link
                href={`${adminLoginPath()}/forgot-password`}
                className="text-[var(--platform-accent)] hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || passkeyLoading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        {passkeysEnabled ? (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--platform-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--platform-card)] px-2 text-[var(--platform-text-secondary)]">
                  or
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading || passkeyLoading || !webAuthnAvailable}
              onClick={() => void handlePasskeyLogin()}
            >
              <Fingerprint className="size-4" />
              {passkeyLoading ? "Waiting for device…" : "Sign in with passkey"}
            </Button>

            {!webAuthnAvailable ? (
              <p className="text-center text-xs text-[var(--platform-text-secondary)]">
                Passkeys are not available in this browser. Use your password instead.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setShowBackupCode((v) => !v)}
              className="w-full text-center text-xs text-[var(--platform-accent)] hover:underline"
            >
              {showBackupCode ? "Hide backup code sign-in" : "Use a backup recovery code"}
            </button>

            {showBackupCode ? (
              <form onSubmit={handleBackupCodeLogin} className="space-y-3 border-t border-[var(--platform-border)] pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-backup-code">Backup code</Label>
                  <input
                    id="admin-backup-code"
                    className="platform-input w-full font-mono"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    placeholder="XXXX-XXXX"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={loading || passkeyLoading}
                >
                  Sign in with backup code
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </AdminAuthShell>
  );
}
