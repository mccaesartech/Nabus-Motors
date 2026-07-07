"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

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

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.replace("/login"), 2500);
  }

  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo variant="purple" brand="corporate" height={52} />
        </div>
        <h1 className="text-2xl font-semibold">Set new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a new password for your True Goshen account.
        </p>

        {!ready && !success && (
          <p className="mt-6 text-sm text-muted-foreground">
            Verifying your reset link… If this takes too long, request a new link from{" "}
            <Link href="/forgot-password" className="text-brand-purple hover:underline">
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
                minLength={8}
                disabled={!ready || loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm">Confirm password</Label>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={!ready || loading}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!ready || loading}
            >
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          If you forgot your password, use{" "}
          <Link href="/forgot-password" className="text-brand-purple hover:underline">
            forgot password
          </Link>{" "}
          or contact us on WhatsApp with your reference number.
        </p>
      </div>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Container className="py-16 sm:py-20">{null}</Container>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
