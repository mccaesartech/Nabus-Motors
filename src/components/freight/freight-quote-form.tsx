"use client";

import { useEffect, useState } from "react";
import { useHashScroll } from "@/hooks/use-hash-scroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppOptIn } from "@/components/forms/whatsapp-opt-in";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { supabase } from "@/lib/supabase/client";
import {
  CargoDescriptionFields,
  useCargoDescriptionFields,
} from "@/components/freight/cargo-description-fields";
import {
  FreightFormAccountFields,
  FreightSubmitSuccess,
  LoggedInContactBanner,
  useFreightFormProfile,
} from "@/components/freight/freight-form-account-fields";
import { buildCargoPayload } from "@/lib/freight/cargo-options";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";

const SERVICE_OPTIONS = [
  { value: "vehicle_shipping", label: "Vehicle shipping" },
  { value: "container_shipping", label: "Container shipping" },
  { value: "documentation", label: "Documentation only" },
  { value: "clearing", label: "Clearing & delivery" },
  { value: "other", label: "Other / not sure" },
] as const;

type FreightQuoteFormProps = {
  initialServiceType?: string;
};

function isValidServiceType(value: string) {
  return SERVICE_OPTIONS.some((opt) => opt.value === value);
}

export function FreightQuoteForm({ initialServiceType }: FreightQuoteFormProps) {
  const { getAccessToken, refreshProfile } = useCustomerAuth();
  const { name, setName, email, setEmail, phone, setPhone, isGuest } =
    useFreightFormProfile();

  const defaultService =
    initialServiceType && isValidServiceType(initialServiceType)
      ? initialServiceType
      : "vehicle_shipping";

  const [serviceType, setServiceType] = useState(defaultService);
  const [originCountry, setOriginCountry] = useState("");
  const { values: cargoValues, setValues: setCargoValues, resetCargoFields, options: cargoOptions } =
    useCargoDescriptionFields();
  const [message, setMessage] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappTouched, setWhatsappTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [success, setSuccess] = useState<{
    referenceCode: string;
    trackingNumber?: string | null;
    accountCreated?: boolean;
    signedIn?: boolean;
    message?: string;
  } | null>(null);

  useHashScroll(initialServiceType);

  useEffect(() => {
    if (initialServiceType && isValidServiceType(initialServiceType)) {
      setServiceType(initialServiceType);
    }
  }, [initialServiceType]);

  function resetForm() {
    if (isGuest) {
      setName("");
      setEmail("");
      setPhone("");
    }
    setOriginCountry("");
    resetCargoFields();
    setMessage("");
    setWhatsappOptIn(false);
    setWhatsappTouched(false);
    setPassword("");
    setConfirmPassword("");
    setServiceType("vehicle_shipping");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSuccess(null);

    if (!phone.trim()) {
      setFeedback({ ok: false, text: "Phone number is required." });
      return;
    }

    if (isGuest) {
      if (password.length < 8) {
        setFeedback({ ok: false, text: "Password must be at least 8 characters." });
        return;
      }
      if (password !== confirmPassword) {
        setFeedback({ ok: false, text: "Passwords do not match." });
        return;
      }
    }

    const cargo = buildCargoPayload(cargoValues, cargoOptions);
    if ("error" in cargo) {
      setFeedback({ ok: false, text: cargo.error });
      return;
    }

    setSubmitting(true);

    try {
      const token = isGuest ? null : await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const effectiveWhatsAppOptIn = whatsappTouched
        ? whatsappOptIn
        : defaultWhatsAppOptIn(phone);

      const res = await fetch("/api/inquiries/freight-quote", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          email,
          phone,
          whatsappOptIn: effectiveWhatsAppOptIn,
          serviceType,
          originCountry,
          cargoDescription: cargo.cargoDescription,
          cargoSize: cargo.cargoSize,
          message,
          password: isGuest ? password : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          text: json.message ?? "Could not submit. Please try again or contact us.",
        });
        return;
      }

      const referenceCode =
        (json.referenceCode as string | undefined) ?? `FQ-${new Date().getFullYear()}-PENDING`;

      let signedIn = false;
      if (isGuest && supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (!signInError) {
          await refreshProfile();
          signedIn = true;
        }
      }

      setSuccess({
        referenceCode,
        trackingNumber: json.trackingNumber,
        accountCreated: Boolean(json.accountCreated) || signedIn,
        signedIn,
        message: json.message,
      });
      resetForm();
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-luxury">
        <FreightSubmitSuccess {...success} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-luxury">
      <div className="grid gap-4 sm:grid-cols-2">
        {isGuest ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="freight-name">Full name *</Label>
              <Input
                id="freight-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="freight-email">Email *</Label>
              <Input
                id="freight-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </>
        ) : (
          <LoggedInContactBanner name={name} email={email} phone={phone} />
        )}

        <FreightFormAccountFields
          isGuest={isGuest}
          phone={phone}
          onPhoneChange={setPhone}
          password={password}
          onPasswordChange={setPassword}
          confirmPassword={confirmPassword}
          onConfirmPasswordChange={setConfirmPassword}
          phoneId="freight-phone"
          phoneRequired={isGuest}
        />

        <div className="sm:col-span-2">
          <WhatsAppOptIn
            id="freight-whatsapp"
            phone={phone}
            checked={whatsappOptIn}
            onChange={setWhatsappOptIn}
            onTouchedChange={setWhatsappTouched}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="freight-service">Service type *</Label>
          <select
            id="freight-service"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            {SERVICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="freight-origin">Origin country / port</Label>
          <Input
            id="freight-origin"
            value={originCountry}
            onChange={(e) => setOriginCountry(e.target.value)}
            placeholder="e.g. USA — Baltimore, UK — Southampton"
          />
        </div>
        <CargoDescriptionFields
          idPrefix="freight"
          values={cargoValues}
          onChange={setCargoValues}
          options={cargoOptions}
        />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="freight-message">Additional details</Label>
          <Textarea
            id="freight-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Timeline, special requirements, etc."
          />
        </div>
      </div>

      {feedback && (
        <p className={feedback.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
          {feedback.text}
        </p>
      )}

      <CustomerDataTrustNote className="pt-1" />

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-purple text-white hover:bg-brand-purple-dark sm:w-auto"
      >
        {submitting ? "Submitting…" : "Request quote"}
      </Button>
    </form>
  );
}
