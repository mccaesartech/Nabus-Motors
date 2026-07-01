"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { BackNav } from "@/components/shared/back-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useCustomerAuth } from "@/context/customer-auth-context";
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
  const redirectTo = searchParams.get("redirect") || "/account";

  useEffect(() => {
    if (!authLoading && user && !sessionPreferenceModalOpen && !pendingRedirect) {
      const safeRedirect =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/account";
      router.replace(safeRedirect);
    }
  }, [authLoading, user, router, redirectTo, sessionPreferenceModalOpen, pendingRedirect]);

  useEffect(() => {
    if (!sessionPreferenceModalOpen && pendingRedirect && user) {
      router.push(pendingRedirect);
      router.refresh();
      setPendingRedirect(null);
    }
  }, [sessionPreferenceModalOpen, pendingRedirect, user, router]);

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
      setError(customerLoginErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    const safeRedirect =
      redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/account";

    if (!hasChosenSessionPreference()) {
      setPendingRedirect(safeRedirect);
      promptSessionPreference();
      setLoading(false);
      return;
    }

    if (chosenPreference !== getSessionPreference()) {
      await applySessionPreference(chosenPreference);
    }

    router.push(safeRedirect);
    router.refresh();
    setLoading(false);
  }

  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md">
        <BackNav href="/" label="Back to home" variant="public" className="mb-6" />
        <div className="mb-8 flex justify-center">
          <Logo variant="purple" brand="corporate" height={52} />
        </div>
        <h1 className="text-2xl font-semibold">Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your personal account to track pre-orders, purchases, and
          message our team.
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
        <form
          className="mt-8 space-y-5"
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
              data-1p-ignore
              data-lpignore="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="customer-login-password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-brand-purple hover:text-foreground"
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
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-border text-brand-purple focus:ring-brand-purple"
            />
            Stay signed in for up to 24 hours
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          If you forgot your password, use{" "}
          <Link href="/forgot-password" className="text-brand-purple hover:underline">
            Forgot password
          </Link>{" "}
          or contact us on WhatsApp with your reference number.
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-brand-purple hover:text-foreground"
          >
            Register
          </Link>
        </p>
      </div>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Container className="py-16 sm:py-20">{null}</Container>}>
      <LoginForm />
    </Suspense>
  );
}
