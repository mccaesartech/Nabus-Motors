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
import {
  hasChosenSessionPreference,
  markSessionPreferencePromptPending,
} from "@/lib/customer/session-preference";
import { validateEmailLocal } from "@/lib/email/validate-email";
import { supabase } from "@/lib/supabase/client";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    loading: authLoading,
    sessionPreferenceModalOpen,
    promptSessionPreference,
  } = useCustomerAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingPreference, setAwaitingPreference] = useState(false);
  const redirectTo = authRedirectFromSearchParams(
    searchParams,
    "/account?welcome=1"
  );

  useEffect(() => {
    if (!authLoading && user && !sessionPreferenceModalOpen && !awaitingPreference) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, sessionPreferenceModalOpen, awaitingPreference, redirectTo]);

  useEffect(() => {
    if (!sessionPreferenceModalOpen && awaitingPreference && user) {
      router.push(redirectTo);
      router.refresh();
      setAwaitingPreference(false);
    }
  }, [sessionPreferenceModalOpen, awaitingPreference, user, router, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const localEmail = validateEmailLocal(email);
    if (!localEmail.ok) {
      setError(localEmail.message);
      return;
    }

    setLoading(true);

    if (!supabase) {
      setError("Account registration is not configured yet. Please try again later.");
      setLoading(false);
      return;
    }

    try {
      const validateRes = await fetch("/api/customer/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: localEmail.normalized }),
      });
      const validateBody = (await validateRes.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!validateRes.ok || !validateBody?.ok) {
        setError(
          validateBody?.message ||
            "This email domain looks invalid."
        );
        setLoading(false);
        return;
      }
    } catch {
      setError("Could not verify email. Please try again.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: localEmail.normalized!,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Welcome must not depend solely on idle sync-account (skipped when email
    // confirm yields no session, or when an older preorder auth user is
    // outside the 7d window). Idempotent server-side.
    if (data.user?.id && localEmail.normalized) {
      try {
        await fetch("/api/customer/post-signup-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data.user.id,
            email: localEmail.normalized,
            name: fullName.trim(),
            phone: phone.trim(),
          }),
        });
      } catch {
        // Non-blocking — sync-account may still send on first authenticated load.
      }
    }

    if (data.session) {
      if (!hasChosenSessionPreference()) {
        markSessionPreferencePromptPending();
        setAwaitingPreference(true);
        promptSessionPreference();
        setLoading(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
      return;
    }

    markSessionPreferencePromptPending();
    router.push(
      redirectTo === "/account?welcome=1"
        ? "/login?registered=1"
        : `/login?registered=1&redirect=${encodeURIComponent(redirectTo)}`
    );
    router.refresh();
  }

  return (
    <NabusAuthSplitShell
      panelTitle="A locker for the cars you keep."
      panelBody="Reservations, imports, and messages from the Dzorwulu floor."
    >
          <h1 className="font-display text-3xl text-[var(--nabus-graphite)]">Open a locker</h1>
          <p className="mt-2 text-sm text-[var(--nabus-muted)]">
            Save cars, reserve on the floor, and keep your paperwork in one place.
          </p>
        <div className="mt-8 space-y-5">
          <GoogleSignInButton
            redirectPath={redirectTo}
            disabled={loading}
            onError={setError}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
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
            <Label htmlFor="customer-register-name">Full name</Label>
            <Input
              id="customer-register-name"
              name="customer-register-name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-register-email">Email</Label>
            <Input
              id="customer-register-email"
              name="customer-register-email"
              type="email"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-register-phone">Phone</Label>
            <Input
              id="customer-register-phone"
              name="customer-register-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-register-password">Password</Label>
            <PasswordInput
              id="customer-register-password"
              name="customer-register-password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-register-confirm">Confirm password</Label>
            <PasswordInput
              id="customer-register-confirm"
              name="customer-register-confirm"
              autoComplete="off"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="h-11 w-full rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
            size="lg"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </Button>
        </form>
          <p className="mt-6 text-center text-sm text-[var(--nabus-text-secondary)] lg:text-left">
            Already have an account?{" "}
            <Link
              href={
                redirectTo === "/account?welcome=1"
                  ? "/login"
                  : `/login?redirect=${encodeURIComponent(redirectTo)}`
              }
              className="font-semibold text-[var(--nabus-primary)] hover:underline"
            >
              Sign in
            </Link>
          </p>
    </NabusAuthSplitShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <RegisterForm />
    </Suspense>
  );
}
