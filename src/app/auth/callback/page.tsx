"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { sanitizeAuthRedirect } from "@/lib/customer/auth-redirect";
import {
  hasChosenSessionPreference,
  markSessionPreferencePromptPending,
} from "@/lib/customer/session-preference";
import { supabase } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      if (!supabase) {
        if (active) setError("Account sign-in is not configured yet.");
        return;
      }

      const oauthError = searchParams.get("error");
      if (oauthError) {
        const description = searchParams.get("error_description");
        if (active) {
          setError(
            description?.replace(/\+/g, " ") ||
              "Google sign-in was cancelled or failed. Please try again."
          );
        }
        return;
      }

      const redirect = sanitizeAuthRedirect(searchParams.get("redirect"));
      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (active) {
            setError("Missing sign-in code. Please try signing in again.");
          }
          return;
        }
      }

      if (!hasChosenSessionPreference()) {
        markSessionPreferencePromptPending();
      }

      window.location.replace(redirect);
    }

    void completeSignIn();

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo variant="purple" brand="corporate" height={52} />
        </div>
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Sign-in incomplete</h1>
            <p className="mt-3 text-sm text-red-600">{error}</p>
            <Button
              render={<Link href="/login" />}
              className="mt-6"
              size="lg"
            >
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Signing you in…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Completing Google sign-in. You will be redirected shortly.
            </p>
          </>
        )}
      </div>
    </Container>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-md text-center">
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </div>
        </Container>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
