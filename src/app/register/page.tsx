"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { BackNav } from "@/components/shared/back-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useCustomerAuth } from "@/context/customer-auth-context";
import {
  hasChosenSessionPreference,
  markSessionPreferencePromptPending,
} from "@/lib/customer/session-preference";
import { supabase } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!authLoading && user && !sessionPreferenceModalOpen && !awaitingPreference) {
      router.replace("/account?welcome=1");
    }
  }, [authLoading, user, router, sessionPreferenceModalOpen, awaitingPreference]);

  useEffect(() => {
    if (!sessionPreferenceModalOpen && awaitingPreference && user) {
      router.push("/account?welcome=1");
      router.refresh();
      setAwaitingPreference(false);
    }
  }, [sessionPreferenceModalOpen, awaitingPreference, user, router]);

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

    setLoading(true);

    if (!supabase) {
      setError("Account registration is not configured yet. Please try again later.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
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

    if (data.session) {
      if (!hasChosenSessionPreference()) {
        markSessionPreferencePromptPending();
        setAwaitingPreference(true);
        promptSessionPreference();
        setLoading(false);
        return;
      }
      router.push("/account?welcome=1");
      router.refresh();
      return;
    }

    markSessionPreferencePromptPending();
    router.push("/login?registered=1");
    router.refresh();
  }

  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md">
        <BackNav href="/" label="Back to home" variant="public" className="mb-6" />
        <div className="mb-8 flex justify-center">
          <Logo variant="purple" brand="corporate" height={52} />
        </div>
        <h1 className="text-2xl font-semibold">Create Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your account to track pre-orders, purchases, and message our
          team.
        </p>
        <form
          className="mt-8 space-y-5"
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
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-purple hover:text-foreground"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Container>
  );
}
