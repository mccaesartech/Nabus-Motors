"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, UserCircle } from "lucide-react";
import { Container } from "@/components/shared/container";
import { BackNav } from "@/components/shared/back-nav";
import { BookAppointmentPanel } from "@/components/checkout/book-appointment-panel";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/context/customer-auth-context";
import {
  clearCheckoutCompleteContext,
  readCheckoutCompleteContext,
  type CheckoutCompleteContext,
} from "@/lib/checkout/complete-context";
import { ROUTES } from "@/lib/routes";

export function CheckoutCompleteClient() {
  const router = useRouter();
  const { user } = useCustomerAuth();
  const [context, setContext] = useState<CheckoutCompleteContext | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readCheckoutCompleteContext();
    if (!stored) {
      router.replace(ROUTES.auto.cart);
      return;
    }
    setContext(stored);
    setReady(true);
  }, [router]);

  if (!ready || !context) {
    return (
      <Container className="py-16">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Container>
    );
  }

  const successTitle =
    context.source === "preorder" ? "Pre-order submitted" : "Order submitted";

  const successDetail =
    context.message ||
    (context.source === "preorder"
      ? "Our team will review your pre-order and contact you about the 25% down payment."
      : "Our team will confirm availability and next steps for your selected vehicles.");

  const hasVehicles = context.vehicles.length > 0;
  const accountOrdersHref = `${ROUTES.corporate.account}?section=orders#my-orders`;

  return (
    <Container className="py-12 sm:py-16">
      <BackNav href={ROUTES.auto.inventory} label="Back to inventory" variant="public" />
      <div className="mx-auto mt-6 max-w-2xl space-y-8">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 px-6 py-8 text-center dark:bg-emerald-950/20">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">{successTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{successDetail}</p>
          {context.registrationId && (
            <p className="mt-2 text-sm font-medium text-foreground">
              Reference: {context.registrationId}
            </p>
          )}
        </div>

        {!user && (
          <div className="rounded-xl border border-brand-purple/25 bg-brand-purple/5 px-5 py-5">
            <div className="flex items-start gap-3">
              <UserCircle className="mt-0.5 size-8 shrink-0 text-brand-purple" />
              <div>
                <p className="font-semibold text-foreground">Track your order anytime</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create an account or sign in with the same email you used at checkout to see order
                  status, book a showroom visit, and message our team.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button render={<Link href={ROUTES.corporate.register} />} className="min-h-11">
                    Create account
                  </Button>
                  <Button
                    render={<Link href={`${ROUTES.corporate.login}?next=${encodeURIComponent(accountOrdersHref)}`} />}
                    variant="outline"
                    className="min-h-11"
                  >
                    Sign in
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasVehicles && (
          <div className="rounded-xl border border-brand-purple/30 bg-gradient-to-br from-brand-purple/10 to-brand-gold/10 p-5 text-center">
            <CalendarCheck className="mx-auto size-10 text-brand-purple" />
            <h2 className="mt-3 text-xl font-semibold">Book appointment to see your cars</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Visit our showroom to inspect your vehicle(s) in person and complete payment with our
              team.
            </p>
          </div>
        )}

        <BookAppointmentPanel
          context={context}
          onBooked={() => clearCheckoutCompleteContext()}
          showSkip={hasVehicles}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button
            render={<Link href={accountOrdersHref} />}
            size="lg"
            className="min-h-12 w-full sm:w-auto"
          >
            View in your account
          </Button>
          {hasVehicles && (
            <Button
              render={<Link href={`${ROUTES.corporate.account}?section=visit#book-visit`} />}
              variant="outline"
              size="lg"
              className="min-h-12 w-full gap-2 sm:w-auto"
            >
              <CalendarCheck className="size-4" />
              Book visit from account
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            render={<Link href={ROUTES.auto.inventory} />}
            className="min-h-12 w-full sm:w-auto"
          >
            Continue browsing
          </Button>
        </div>
      </div>
    </Container>
  );
}
