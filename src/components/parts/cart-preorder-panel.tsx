"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppOptIn } from "@/components/forms/whatsapp-opt-in";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";
import { formatCheckoutPrice } from "@/lib/currency/checkout";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { supabase } from "@/lib/supabase/client";
import {
  downPaymentUsd,
  PREORDER_DOWN_PAYMENT_RATE,
  resolveVehicleCheckoutMode,
} from "@/lib/vehicles/availability";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";
import type { CartVehicleResolved } from "@/lib/parts/cart-types";
import { cn } from "@/lib/utils";

type CartPreorderPanelProps = {
  line: CartVehicleResolved;
  sharedName: string;
  sharedEmail: string;
  sharedPhone: string;
  onSuccess: (
    vehicleId: string,
    payload: {
      message: string;
      inquiryId?: string;
      registrationId?: string;
      vehicleName: string;
    }
  ) => void;
  onSkip: (vehicleId: string) => void;
  className?: string;
};

export function CartPreorderPanel({
  line,
  sharedName,
  sharedEmail,
  sharedPhone,
  onSuccess,
  onSkip,
  className,
}: CartPreorderPanelProps) {
  const formatCartPrice = (usd: number) => formatCheckoutPrice(usd);
  const { user, profile, displayName, getAccessToken, refreshProfile } =
    useCustomerAuth();

  const checkoutMode = resolveVehicleCheckoutMode(line.status, line.intent);
  const isUnavailable =
    checkoutMode === "unavailable" ||
    (checkoutMode === "preorder" && line.status === "sold");

  const [expanded, setExpanded] = useState(
    line.intent === "pre_order" || line.status === "pre_order"
  );
  const [wantsPreorder, setWantsPreorder] = useState<boolean | null>(
    line.intent === "pre_order" || line.status === "pre_order" ? true : null
  );

  const [name, setName] = useState(sharedName);
  const [email, setEmail] = useState(sharedEmail);
  const [phone, setPhone] = useState(sharedPhone);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappTouched, setWhatsappTouched] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [shippingHandling, setShippingHandling] = useState("");
  const [shippingTermsAccepted, setShippingTermsAccepted] = useState(false);
  const [clearingNotice, setClearingNotice] = useState("");
  const [preorderTerms, setPreorderTerms] = useState({
    a: "Option A — I will arrange my own shipping and clearing",
    b: "Option B — True Goshen handles freight forwarding & clearing",
    c: "Option C — I need consultation before deciding",
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const downPayment = downPaymentUsd(line.priceUsd);
  const isGuest = !user;

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const s = json?.settings;
        if (!s) return;
        if (s.clearing_fee_notice) setClearingNotice(s.clearing_fee_notice);
        setPreorderTerms((prev) => ({
          a: s.preorder_terms_a || prev.a,
          b: s.preorder_terms_b || prev.b,
          c: s.preorder_terms_c || prev.c,
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (sharedName) setName(sharedName);
    if (sharedEmail) setEmail(sharedEmail);
    if (sharedPhone) setPhone(sharedPhone);
  }, [sharedName, sharedEmail, sharedPhone]);

  useEffect(() => {
    if (!user) return;
    if (!name && displayName) setName(displayName);
    if (!email && user.email) setEmail(user.email);
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [user, displayName, profile?.phone, name, email, phone]);

  const unavailableMessage =
    line.status === "sold"
      ? "This vehicle has been sold and is no longer available."
      : "This vehicle is not available for immediate purchase.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!acknowledge) {
      setFeedback({
        ok: false,
        text: "Please acknowledge the 25% down payment requirement.",
      });
      return;
    }
    if (!shippingHandling) {
      setFeedback({
        ok: false,
        text: "Please select who will handle shipping and clearing.",
      });
      return;
    }
    if (!shippingTermsAccepted) {
      setFeedback({
        ok: false,
        text: "Please accept the shipping and clearing terms.",
      });
      return;
    }
    if (isGuest) {
      if (!phone.trim()) {
        setFeedback({ ok: false, text: "Phone number is required." });
        return;
      }
      if (password.length < 8) {
        setFeedback({
          ok: false,
          text: "Password must be at least 8 characters.",
        });
        return;
      }
      if (password !== confirmPassword) {
        setFeedback({ ok: false, text: "Passwords do not match." });
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = isGuest ? null : await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const effectiveWhatsAppOptIn = whatsappTouched
        ? whatsappOptIn
        : defaultWhatsAppOptIn(phone);

      const res = await fetch("/api/inquiries/preorder", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          email,
          phone,
          whatsappOptIn: effectiveWhatsAppOptIn,
          message,
          password: isGuest ? password : undefined,
          vehicleId: line.vehicleId,
          vehiclePriceUsd: line.priceUsd,
          vehicleSlug: line.slug,
          vehicleTitle: line.name,
          acknowledgeDownPayment: acknowledge,
          shippingHandling,
          shippingTermsAccepted,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          text: json.message ?? "Could not submit pre-order. Please try again.",
        });
        return;
      }

      if (isGuest && supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (!signInError) {
          await refreshProfile();
        }
      }

      onSuccess(line.vehicleId, {
        message: json.message ?? "Pre-order submitted.",
        inquiryId: json.inquiryId ? String(json.inquiryId) : undefined,
        registrationId: json.registrationId ? String(json.registrationId) : undefined,
        vehicleName: line.name,
      });
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (isUnavailable) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3",
          className
        )}
      >
        <p className="text-sm font-medium text-destructive">{unavailableMessage}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 text-destructive"
          onClick={() => onSkip(line.vehicleId)}
        >
          Remove from cart
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/20",
        className
      )}
    >
      <p className="text-sm text-foreground">{unavailableMessage}</p>
      <p className="mt-1 text-sm font-medium text-foreground">
        Would you like to pre-order this vehicle?
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {line.name} — {formatCartPrice(line.priceUsd)} · Down payment{" "}
        {formatCartPrice(downPayment)} ({Math.round(PREORDER_DOWN_PAYMENT_RATE * 100)}%)
      </p>

      {wantsPreorder === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setWantsPreorder(true)}>
            Yes, pre-order
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSkip(line.vehicleId)}
          >
            No, remove from cart
          </Button>
        </div>
      )}

      {wantsPreorder === true && (
        <>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between text-left text-sm font-medium text-brand-purple"
            onClick={() => setExpanded((v) => !v)}
          >
            Pre-order details
            {expanded ? (
              <ChevronUp className="size-4 shrink-0" />
            ) : (
              <ChevronDown className="size-4 shrink-0" />
            )}
          </button>

          {expanded && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-amber-200/60 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor={`preorder-name-${line.vehicleId}`}>Full name *</Label>
                <Input
                  id={`preorder-name-${line.vehicleId}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`preorder-email-${line.vehicleId}`}>Email *</Label>
                <Input
                  id={`preorder-email-${line.vehicleId}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`preorder-phone-${line.vehicleId}`}>Phone *</Label>
                <Input
                  id={`preorder-phone-${line.vehicleId}`}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={isGuest}
                />
              </div>
              <WhatsAppOptIn
                id={`preorder-whatsapp-${line.vehicleId}`}
                phone={phone}
                checked={whatsappOptIn}
                onChange={setWhatsappOptIn}
                onTouchedChange={setWhatsappTouched}
              />

              {isGuest && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor={`preorder-password-${line.vehicleId}`}>
                      Password *
                    </Label>
                    <PasswordInput
                      id={`preorder-password-${line.vehicleId}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`preorder-confirm-${line.vehicleId}`}>
                      Confirm password *
                    </Label>
                    <PasswordInput
                      id={`preorder-confirm-${line.vehicleId}`}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="text-brand-purple hover:underline">
                      Sign in
                    </Link>
                  </p>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor={`preorder-message-${line.vehicleId}`}>Message</Label>
                <Textarea
                  id={`preorder-message-${line.vehicleId}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/50 px-3 py-3">
                <p className="text-sm font-semibold">Shipping &amp; clearing</p>
                <p className="text-xs text-muted-foreground">
                  {clearingNotice ||
                    "Clearing fees vary by shipment. Our team will provide a detailed breakdown before you commit."}
                </p>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-muted-foreground">
                    Who handles shipping? *
                  </legend>
                  {(
                    [
                      ["customer_arranged", preorderTerms.a],
                      ["true_goshen", preorderTerms.b],
                      ["consultation", preorderTerms.c],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`shipping-${line.vehicleId}`}
                        value={value}
                        checked={shippingHandling === value}
                        onChange={() => setShippingHandling(value)}
                        className="mt-1"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shippingTermsAccepted}
                    onChange={(e) => setShippingTermsAccepted(e.target.checked)}
                    className="mt-1 size-4 rounded border-border"
                  />
                  <span>
                    I understand clearing fees and duties are assessed separately.
                  </span>
                </label>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acknowledge}
                  onChange={(e) => setAcknowledge(e.target.checked)}
                  className="mt-1 size-4 rounded border-border"
                />
                <span>
                  I understand a 25% down payment ({formatCartPrice(downPayment)}) is
                  required to secure this pre-order.
                </span>
              </label>

              {feedback && (
                <p
                  className={
                    feedback.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"
                  }
                >
                  {feedback.text}
                </p>
              )}

              <CustomerDataTrustNote />

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit pre-order"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSkip(line.vehicleId)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
