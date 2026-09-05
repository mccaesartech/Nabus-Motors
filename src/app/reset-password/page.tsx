"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/customer/password-strength-meter";
import { NabusAuthSplitShell } from "@/components/nabus/nabus-auth-split-shell";
import { supabase } from "@/lib/supabase/client";
import {
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/customer/password-policy";

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const policy = validatePasswordPolicy(password);
    if (!policy.ok) {
      setError(policy.message);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!supabase) {
      setError("Password reset is not configured.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      void fetch("/api/customer/auth/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ event: "password_changed" }),
      }).catch(() => {});
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.replace("/login"), 2500);
  }

  return (
    <NabusAuthSplitShell
      panelTitle="Secure your account"
      panelBody="Choose a strong password. You'll be signed out of other devices automatically."
    >
      <h1 className="text-2xl font-bold text-[var(--nabus-charcoal)]">Set new password</h1>
      <p className="mt-2 text-sm text-[var(--nabus-text-secondary)]">
        Choose a new password for your Nabus Motors account.
      </p>

      {!ready && !success && (
        <p className="mt-6 text-sm text-[var(--nabus-text-secondary)]">
          Verifying your reset link… If this takes too long, request a new link from{" "}
          <Link href="/forgot-password" className="text-[var(--nabus-primary)] hover:underline">
            forgot password
          </Link>
          .
        </p>
      )}

      {success ? (
        <p className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Password updated. Redirecting you to sign in…
        </p>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={handleSubmit}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        >
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={PASSWORD_MIN_LENGTH}
              disabled={!ready || loading}
              className="h-11 rounded-lg border-[var(--nabus-input-border)]"
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">Confirm password</Label>
            <PasswordInput
              id="reset-confirm"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={PASSWORD_MIN_LENGTH}
              disabled={!ready || loading}
              className="h-11 rounded-lg border-[var(--nabus-input-border)]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="h-11 w-full rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
            size="lg"
            disabled={!ready || loading}
          >
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-[var(--nabus-text-secondary)] lg:text-left">
        If you forgot your password, use{" "}
        <Link href="/forgot-password" className="text-[var(--nabus-primary)] hover:underline">
          forgot password
        </Link>{" "}
        or contact us on WhatsApp with your reference number.
      </p>
    </NabusAuthSplitShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
