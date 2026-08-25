"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  PLATFORM_PASSWORD_MIN_LENGTH,
  validatePlatformPasswordPolicy,
} from "@/lib/platform/password-policy";

function AdminResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [ready, setReady] = useState(false);
  const [emailHint, setEmailHint] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This reset link is missing or incomplete. Request a new one.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/reset-password?token=${encodeURIComponent(token)}`,
          { credentials: "same-origin" }
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.message ?? "Invalid or expired reset link.");
          return;
        }
        setEmailHint(typeof json.emailHint === "string" ? json.emailHint : "");
        setReady(true);
      } catch {
        if (!cancelled) setError("Could not verify the reset link. Try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const policy = validatePlatformPasswordPolicy(password);
    if (!policy.ok) {
      setError(policy.message);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not update password.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.replace(adminLoginPath()), 2500);
    } catch {
      setError("Could not update password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AdminAuthShell>
      <div className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] p-5 shadow-lg sm:p-8">
        <h1 className="text-center text-xl font-semibold text-[var(--platform-text)]">
          Set new password
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--platform-text-secondary)]">
          {emailHint
            ? `Choose a new password for ${emailHint}.`
            : "Choose a new password for your True Goshen platform account."}
        </p>

        {success ? (
          <p className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Password updated. Redirecting you to sign in…
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
          >
            <div className="space-y-1.5">
              <Label htmlFor="admin-reset-password">New password</Label>
              <PasswordInput
                id="admin-reset-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={PLATFORM_PASSWORD_MIN_LENGTH}
                disabled={!ready || loading}
                className="platform-input"
              />
              <p className="text-xs text-[var(--platform-text-secondary)]">
                At least {PLATFORM_PASSWORD_MIN_LENGTH} characters, with upper,
                lower, and a number.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-reset-confirm">Confirm password</Label>
              <PasswordInput
                id="admin-reset-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={PLATFORM_PASSWORD_MIN_LENGTH}
                disabled={!ready || loading}
                className="platform-input"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={!ready || loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[var(--platform-text-secondary)]">
          <Link
            href={`${adminLoginPath()}/forgot-password`}
            className="text-[var(--platform-accent)] hover:underline"
          >
            Request a new link
          </Link>
          {" · "}
          <Link
            href={adminLoginPath()}
            className="text-[var(--platform-accent)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AdminAuthShell>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AdminAuthShell>
          <p className="text-sm text-[var(--platform-text-secondary)]">Loading…</p>
        </AdminAuthShell>
      }
    >
      <AdminResetPasswordForm />
    </Suspense>
  );
}
