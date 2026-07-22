"use client";

import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { adminDashboardPath } from "@/lib/admin/paths";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  const passkeysEnabled = isWebAuthnFeatureEnabled();
  const webAuthnAvailable = isBrowserWebAuthnAvailable();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (needsPasswordSetup) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        ...(needsPasswordSetup ? { confirmPassword } : {}),
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (data.needsPasswordSetup) {
        setNeedsPasswordSetup(true);
      }
      setError(data.message ?? "Login failed.");
      setLoading(false);
      return;
    }

    window.location.assign(data.redirect ?? adminDashboardPath());
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
        window.location.assign(result.redirect ?? adminDashboardPath());
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
      window.location.assign(result.redirect ?? adminDashboardPath());
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
          Team members: enter your email and password. Owner: leave email blank and use the master password.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        >
          <div className="space-y-1.5">
            <Label htmlFor="admin-portal-email">Email (team members)</Label>
            <input
              id="admin-portal-email"
              name="admin-portal-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (needsPasswordSetup) {
                  setNeedsPasswordSetup(false);
                  setConfirmPassword("");
                }
              }}
              className="platform-input w-full"
              placeholder="you@company.com (team members)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-portal-password">
              {needsPasswordSetup ? "Create password" : "Password"}
            </Label>
            <PasswordInput
              id="admin-portal-password"
              name="admin-portal-password"
              autoComplete={needsPasswordSetup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={needsPasswordSetup ? 8 : undefined}
              className="platform-input"
            />
          </div>
          {needsPasswordSetup && (
            <div className="space-y-1.5">
              <Label htmlFor="admin-portal-confirm-password">Confirm password</Label>
              <PasswordInput
                id="admin-portal-confirm-password"
                name="admin-portal-confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="platform-input"
              />
              <p className="text-xs text-[var(--platform-text-secondary)]">
                This account has no password yet. Enter your new password twice to set it and sign in.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || passkeyLoading}>
            {loading
              ? needsPasswordSetup
                ? "Setting password…"
                : "Signing in…"
              : needsPasswordSetup
                ? "Set password & sign in"
                : "Sign In"}
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
