"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppOptIn } from "@/components/forms/whatsapp-opt-in";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCheckoutPrice } from "@/lib/currency/checkout";
import { useCustomerAuth } from "@/context/customer-auth-context";
import {
  downPaymentUsd,
  PREORDER_DOWN_PAYMENT_RATE,
} from "@/lib/vehicles/availability";
import { formatVehicleName } from "@/lib/format";
import { GHANA_WHATSAPP } from "@/lib/data/vehicle-images";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";
import { saveCheckoutCompleteContext } from "@/lib/checkout/complete-context";
import { buildPreorderPrintSnapshot } from "@/lib/checkout/print-snapshot";
import { ROUTES } from "@/lib/routes";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import { usePartsCart } from "@/context/parts-cart-context";
import { cn } from "@/lib/utils";

type PreorderFormProps = {
  vehicle: Vehicle;
  triggerLabel?: string;
  triggerClassName?: string;
};

export function PreorderForm({
  vehicle,
  triggerLabel = "Pre-Order This Vehicle",
  triggerClassName,
}: PreorderFormProps) {
  const formatCartPrice = (usd: number) => formatCheckoutPrice(usd);
  const router = useRouter();
  const { isVehicleInCart, removeVehicle } = usePartsCart();
  const { user, profile, displayName, getAccessToken, refreshProfile } =
    useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    b: "Option B — Nabus Motors handles freight forwarding & clearing",
    c: "Option C — I need consultation before deciding",
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const downPayment = downPaymentUsd(vehicle.price);
  const downPaymentFormatted = formatCartPrice(downPayment);
  const vehicleName = formatVehicleName(vehicle);
  const isGuest = !user;

  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? GHANA_WHATSAPP;
  const whatsappMessage = encodeURIComponent(
    `Hi, I'd like to pre-order the ${vehicleName}. I understand a 25% down payment (${downPaymentFormatted}) is required.`
  );

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    if (!name && displayName) setName(displayName);
    if (!email && user.email) setEmail(user.email);
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [open, user, displayName, profile?.phone, name, email, phone]);

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setWhatsappOptIn(false);
    setWhatsappTouched(false);
    setAcknowledge(false);
    setShippingHandling("");
    setShippingTermsAccepted(false);
  }

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
          vehicleId: vehicle.id,
          vehiclePriceUsd: vehicle.price,
          vehicleSlug: vehicle.slug,
          vehicleTitle: vehicleName,
          acknowledgeDownPayment: acknowledge,
          shippingHandling,
          shippingTermsAccepted,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          text: json.message ?? "Could not submit. Please try again.",
        });
        return;
      }
      if (isGuest) {
        setFeedback({
          ok: true,
          text: `${json.message} Register through our secure account service to track this pre-order.`,
        });
      }

      saveCheckoutCompleteContext({
        source: "preorder",
        inquiryId: json.inquiryId ? String(json.inquiryId) : undefined,
        registrationId: json.registrationId ? String(json.registrationId) : undefined,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicles: [
          {
            id: vehicle.id,
            name: vehicleName,
          },
        ],
        message: json.message,
        preorder: buildPreorderPrintSnapshot({
          inquiryId: json.inquiryId ? String(json.inquiryId) : undefined,
          registrationId: json.registrationId ? String(json.registrationId) : undefined,
          vehicleName,
          vehicleSlug: vehicle.slug,
          vehiclePriceUsd: vehicle.price,
          downPaymentUsd: downPaymentUsd(vehicle.price),
        }),
      });

      if (isVehicleInCart(vehicle.id)) {
        removeVehicle(vehicle.id);
      }

      recordVehicleEngagement("preorder", vehicle);

      setOpen(false);
      resetForm();
      router.push(ROUTES.auto.cartComplete);
      router.refresh();
      return;
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            className={cn(
              "w-full bg-brand-purple text-white hover:bg-brand-purple-dark",
              triggerClassName
            )}
          >
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100dvh-var(--header-height)-2rem)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pre-Order {vehicleName}</DialogTitle>
          <DialogDescription>
            Reserve this vehicle with a {Math.round(PREORDER_DOWN_PAYMENT_RATE * 100)}%
            down payment. Our team will confirm availability and next steps.
            {isGuest && (
              <>
                {" "}
                Fill in your details below — we&apos;ll create your account automatically
                so you can track this pre-order.
              </>
            )}
            {user && profile?.registration_id && (
              <>
                {" "}
                Pre-orders are linked to your account ({profile.registration_id}). You can
                pre-order multiple vehicles — each requires its own 25% deposit.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Down payment required
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {downPaymentFormatted}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            25% of {formatCartPrice(vehicle.price)} vehicle price
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Your details</p>

            <div className="space-y-1.5">
              <Label htmlFor="preorder-name">Full name *</Label>
              <Input
                id="preorder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preorder-email">Email *</Label>
              <Input
                id="preorder-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preorder-phone">Phone *</Label>
              <Input
                id="preorder-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={isGuest}
                autoComplete="tel"
              />
            </div>
            <WhatsAppOptIn
              id="preorder-whatsapp"
              phone={phone}
              checked={whatsappOptIn}
              onChange={setWhatsappOptIn}
              onTouchedChange={setWhatsappTouched}
            />

            {isGuest && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="preorder-password">Password *</Label>
                  <PasswordInput
                    id="preorder-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preorder-confirm-password">Confirm password *</Label>
                  <PasswordInput
                    id="preorder-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Already have an account? Enter your existing password above to sign in
                  and complete this pre-order.{" "}
                  <Link
                    href="/login"
                    className="font-medium text-brand-purple hover:underline"
                  >
                    Sign in separately
                  </Link>
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preorder-message">Message</Label>
            <Textarea
              id="preorder-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Preferred delivery timeline, financing questions, etc."
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/50 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Shipping &amp; clearing</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {clearingNotice ||
                "Clearing fees vary by shipment. Our team will provide a detailed breakdown before you commit."}
            </p>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-muted-foreground">
                Who handles shipping? *
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="shipping-handling"
                  value="customer_arranged"
                  checked={shippingHandling === "customer_arranged"}
                  onChange={() => setShippingHandling("customer_arranged")}
                  className="mt-1"
                />
                <span>{preorderTerms.a}</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="shipping-handling"
                  value="true_goshen"
                  checked={shippingHandling === "true_goshen"}
                  onChange={() => setShippingHandling("true_goshen")}
                  className="mt-1"
                />
                <span>{preorderTerms.b}</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="shipping-handling"
                  value="consultation"
                  checked={shippingHandling === "consultation"}
                  onChange={() => setShippingHandling("consultation")}
                  className="mt-1"
                />
                <span>{preorderTerms.c}</span>
              </label>
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={shippingTermsAccepted}
                onChange={(e) => setShippingTermsAccepted(e.target.checked)}
                className="mt-1 size-4 rounded border-border"
              />
              <span>
                I understand clearing fees and duties are assessed separately and I have read the
                notice above.
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
              I understand a 25% down payment ({downPaymentFormatted}) is required
              to secure this pre-order.
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

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting
                ? isGuest
                  ? "Creating account & submitting…"
                  : "Submitting…"
                : isGuest
                  ? "Create Account & Submit Pre-Order"
                  : "Submit Pre-Order Request"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              render={
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircle className="size-4" />
              Pre-Order via WhatsApp
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
