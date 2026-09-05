"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NabusAuthSplitShell } from "@/components/nabus/nabus-auth-split-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/customer/google-sign-in-button";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { authRedirectFromSearchParams } from "@/lib/customer/auth-redirect";
import { customerLoginErrorMessage } from "@/lib/customer/login-errors";
import {
  getSessionPreference,
  hasChosenSessionPreference,
  markSessionPreferencePromptPending,
  rememberMeChecked,
  setSessionPreference,
  type SessionPreference,
} from "@/lib/customer/session-preference";
import { supabase } from "@/lib/supabase/client";
import { resolveCustomerApiUrl } from "@/lib/site-url";
import { ROUTES } from "@/lib/routes";

async function reportFailedLoginAttempt(email: string) {
  try {
    await fetch(resolveCustomerApiUrl("/api/customer/auth/login-attempt"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), method: "password" }),
    });
  } catch {
    // non-blocking
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    loading: authLoading,
    sessionPreferenceModalOpen,
    promptSessionPreference,
    applySessionPreference,
  } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() =>
    rememberMeChecked(getSessionPreference())
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const registered = searchParams.get("registered") === "1";
  const expired = searchParams.get("expired") === "1";
  const redirectTo = authRedirectFromSearchParams(searchParams);

  useEffect(() => {
    if (!authLoading && user && !sessionPreferenceModalOpen && !pendingRedirect) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, redirectTo, sessionPreferenceModalOpen, pendingRedirect]);

  useEffect(() => {
    if (!sessionPreferenceModalOpen && pendingRedirect && user) {
      window.location.assign(pendingRedirect);
      setPendingRedirect(null);
    }
  }, [sessionPreferenceModalOpen, pendingRedirect, user]);

  useEffect(() => {
    if (registered && !hasChosenSessionPreference()) {
      markSessionPreferencePromptPending();
    }
  }, [registered]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("Account sign-in is not configured yet. Please try again later.");
      setLoading(false);
      return;
    }

    const chosenPreference: SessionPreference = rememberMe
      ? "stay_signed_in"
      : getSessionPreference() ?? "ask_each_time";

    if (hasChosenSessionPreference()) {
      setSessionPreference(chosenPreference);
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      void reportFailedLoginAttempt(email);
      setError(customerLoginErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    try {
      sessionStorage.setItem("tg_pending_login_method", "password");
    } catch {
      // ignore
    }

    if (!hasChosenSessionPreference()) {
      setPendingRedirect(redirectTo);
      promptSessionPreference();
      setLoading(false);
      return;
    }

    if (chosenPreference !== getSessionPreference()) {
      await applySessionPreference(chosenPreference);
    }

    window.location.assign(redirectTo);
  }

  return (
    <NabusAuthSplitShell
      panelTitle="Your vehicles, orders, and imports — all in one place."
      panelBody="Sign in to track pre-orders, manage purchases, and message our showroom team."
    >
          <h1 className="text-2xl font-bold text-[var(--nabus-charcoal)]">Welcome Back</h1>
          <p className="mt-2 text-sm text-[var(--nabus-text-secondary)]">
            Sign in to track pre-orders, purchases, and message our team.
          </p>
          {expired && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Session expired — please sign in again.
            </p>
          )}
          {registered && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Account created. Sign in to view your registration ID and track pre-orders.
            </p>
          )}
          <div className="mt-8 space-y-5">
            <GoogleSignInButton
              redirectPath={redirectTo}
              rememberMe={rememberMe}
              disabled={loading}
              onError={setError}
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--nabus-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--nabus-surface)] px-2 text-[var(--nabus-text-secondary)]">
                  or
                </span>
              </div>
            </div>
          </div>
          <form
            className="mt-5 space-y-5"
            onSubmit={handleSubmit}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
          >
            <div className="space-y-1.5">
              <Label htmlFor="customer-login-email">Email</Label>
              <Input
                id="customer-login-email"
                name="customer-login-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-lg border-[var(--nabus-input-border)] focus-visible:border-[var(--nabus-primary)]"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="customer-login-password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[var(--nabus-primary)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="customer-login-password"
                name="customer-login-password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-lg border-[var(--nabus-input-border)]"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--nabus-text-secondary)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-[var(--nabus-input-border)] text-[var(--nabus-primary)]"
              />
              Stay signed in for up to 24 hours
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
              size="lg"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--nabus-text-secondary)]">
            Don&apos;t have an account?{" "}
            <Link
              href={
                redirectTo === ROUTES.corporate.account
                  ? ROUTES.corporate.register
                  : `${ROUTES.corporate.register}?redirect=${encodeURIComponent(redirectTo)}`
              }
              className="font-semibold text-[var(--nabus-primary)] hover:underline"
            >
              Create account
            </Link>
          </p>
    </NabusAuthSplitShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <LoginForm />
    </Suspense>
  );
}
