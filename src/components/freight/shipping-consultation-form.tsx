"use client";

import { useState } from "react";
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
  useFreightFormProfile,
} from "@/components/freight/freight-form-account-fields";
import { buildCargoPayload } from "@/lib/freight/cargo-options";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";

export function ShippingConsultationForm() {
  useHashScroll();
  const { getAccessToken, refreshProfile } = useCustomerAuth();
  const { name, setName, email, setEmail, phone, setPhone, isGuest } =
    useFreightFormProfile();

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
          serviceType: "other",
          originCountry,
          cargoDescription: cargo.cargoDescription,
          cargoSize: cargo.cargoSize,
          message: `[Shipping consultation] ${message}`.trim(),
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
        message:
          json.message ??
          "Thank you — our freight team will contact you shortly to schedule your consultation.",
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-luxury"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="consult-name">Full name *</Label>
          <Input
            id="consult-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="consult-email">Email *</Label>
          <Input
            id="consult-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <FreightFormAccountFields
          isGuest={isGuest}
          phone={phone}
          onPhoneChange={setPhone}
          password={password}
          onPasswordChange={setPassword}
          confirmPassword={confirmPassword}
          onConfirmPasswordChange={setConfirmPassword}
          phoneId="consult-phone"
        />

        <div className="sm:col-span-2">
          <WhatsAppOptIn
            id="consult-whatsapp"
            phone={phone}
            checked={whatsappOptIn}
            onChange={setWhatsappOptIn}
            onTouchedChange={setWhatsappTouched}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="consult-origin">Origin country</Label>
          <Input
            id="consult-origin"
            value={originCountry}
            onChange={(e) => setOriginCountry(e.target.value)}
            placeholder="e.g. China, Japan, USA"
          />
        </div>
        <CargoDescriptionFields
          idPrefix="consult"
          values={cargoValues}
          onChange={setCargoValues}
          options={cargoOptions}
        />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="consult-message">Questions or requirements *</Label>
          <Textarea
            id="consult-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            placeholder="Timeline, budget, preferred shipping method, etc."
          />
        </div>
      </div>

      {feedback && (
        <p className={feedback.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
          {feedback.text}
        </p>
      )}

      <CustomerDataTrustNote className="pt-1" />

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Submitting…" : "Request consultation"}
      </Button>
    </form>
  );
}
