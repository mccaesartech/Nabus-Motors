"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppOptIn } from "@/components/forms/whatsapp-opt-in";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { makes } from "@/lib/data/catalog-meta";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const BODY_TYPES = ["SUV", "Sedan", "Luxury", "Truck", "Commercial", "Electric"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid"];
const CONDITIONS = ["New", "Used", "Certified Pre-Owned"];
const TIMELINES = [
  "As soon as possible",
  "Within 1 month",
  "Within 3 months",
  "Within 6 months",
  "Flexible",
];

type CustomVehicleRequestFormProps = {
  className?: string;
  compact?: boolean;
  onSuccess?: (payload: {
    message: string;
    referenceCode?: string;
    inquiryId?: string;
    registrationId?: string;
  }) => void;
};

export function CustomVehicleRequestForm({
  className,
  compact = false,
  onSuccess,
}: CustomVehicleRequestFormProps) {
  const { user, profile, displayName, getAccessToken, refreshProfile } =
    useCustomerAuth();

  const [make, setMake] = useState("");
  const [makeOther, setMakeOther] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredTimeline, setPreferredTimeline] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappTouched, setWhatsappTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [successDetails, setSuccessDetails] = useState<{
    referenceCode?: string;
    inquiryId?: string;
  } | null>(null);

  const isGuest = !user;
  const effectiveMake = make === "Other" ? makeOther.trim() : make.trim();

  useEffect(() => {
    if (!user) return;
    if (!name && displayName) setName(displayName);
    if (!email && user.email) setEmail(user.email);
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [user, displayName, profile?.phone, name, email, phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSuccessDetails(null);

    if (!effectiveMake || !model.trim()) {
      setFeedback({ ok: false, text: "Make and model are required." });
      return;
    }
    if (!name.trim() || !email.trim()) {
      setFeedback({ ok: false, text: "Name and email are required." });
      return;
    }
    if (!phone.trim()) {
      setFeedback({ ok: false, text: "Phone number is required." });
      return;
    }
    if (isGuest) {
      if (!password || password.length < 8) {
        setFeedback({ ok: false, text: "Password must be at least 8 characters." });
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

      const res = await fetch("/api/inquiries/custom-preorder", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: isGuest ? password : undefined,
          whatsappOptIn: effectiveWhatsAppOptIn,
          make: effectiveMake,
          model: model.trim(),
          year: year.trim() || undefined,
          budgetMin: budgetMin ? Number(budgetMin) : undefined,
          budgetMax: budgetMax ? Number(budgetMax) : undefined,
          bodyType: bodyType || undefined,
          fuelType: fuelType || undefined,
          condition: condition || undefined,
          notes: notes.trim() || undefined,
          preferredTimeline: preferredTimeline || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          text: json.message ?? "Could not submit request. Please try again.",
        });
        return;
      }

      setFeedback({ ok: true, text: json.message ?? "Request submitted." });
      setSuccessDetails({
        referenceCode: json.referenceCode,
        inquiryId: json.inquiryId,
      });
      onSuccess?.({
        message: json.message,
        referenceCode: json.referenceCode,
        inquiryId: json.inquiryId,
        registrationId: json.registrationId,
      });
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (successDetails) {
    const trackHref = successDetails.inquiryId
      ? `/account?section=vehicle-requests&request=${successDetails.inquiryId}#vehicle-requests`
      : "/account#vehicle-requests";

    return (
      <div
        className={cn(
          "space-y-6 rounded-xl border border-brand-purple/30 bg-gradient-to-b from-brand-purple/10 to-brand-gold/5 p-6 sm:p-8",
          className
        )}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Request submitted!</h2>
          {successDetails.referenceCode && (
            <p className="mt-2 font-mono text-lg font-semibold text-brand-purple">
              {successDetails.referenceCode}
            </p>
          )}
          {feedback?.text && (
            <p className="mt-3 max-w-md text-sm text-muted-foreground">{feedback.text}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Track status, message our team, or book a visit — all from your account.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            render={<Link href={trackHref} />}
            className="min-h-11 bg-brand-purple text-white hover:bg-brand-purple-dark"
          >
            Track in your account
          </Button>
          <Button
            render={<Link href={ROUTES.auto.inventory} />}
            variant="outline"
            className="min-h-11"
          >
            Browse inventory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-6 rounded-xl border border-brand-purple/20 bg-gradient-to-b from-brand-purple/5 to-transparent p-5 sm:p-6",
        className
      )}
    >
      {!compact && (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-purple">
            <Search className="size-3.5" />
            Custom request
          </div>
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            Request a vehicle not listed
          </h2>
          <p className="text-sm text-muted-foreground">
            Tell us what you want. Our owners and managers will review sourcing options and
            follow up by email or WhatsApp.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cvr-make">Make / brand *</Label>
          <Select value={make || undefined} onValueChange={(v) => setMake(v ?? "")}>
            <SelectTrigger id="cvr-make" className="w-full">
              <SelectValue placeholder="Select or choose Other" />
            </SelectTrigger>
            <SelectContent>
              {makes.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {make === "Other" && (
            <Input
              value={makeOther}
              onChange={(e) => setMakeOther(e.target.value)}
              placeholder="Enter brand name"
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cvr-model">Model *</Label>
          <Input
            id="cvr-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. Camry, X5"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cvr-year">Year (specific or range)</Label>
          <Input
            id="cvr-year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2022 or 2018–2022"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cvr-budget-min">Budget min (GHS)</Label>
          <Input
            id="cvr-budget-min"
            type="number"
            min={0}
            step={1000}
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="e.g. 150000"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cvr-budget-max">Budget max (GHS)</Label>
          <Input
            id="cvr-budget-max"
            type="number"
            min={0}
            step={1000}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="e.g. 350000"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Body type</Label>
          <Select
            value={bodyType || undefined}
            onValueChange={(v) => setBodyType(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {BODY_TYPES.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Fuel type</Label>
          <Select
            value={fuelType || undefined}
            onValueChange={(v) => setFuelType(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Condition</Label>
          <Select
            value={condition || undefined}
            onValueChange={(v) => setCondition(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="New or used" />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Preferred timeline</Label>
          <Select
            value={preferredTimeline || undefined}
            onValueChange={(v) => setPreferredTimeline(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {TIMELINES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cvr-notes">Additional notes (color, trim, features)</Label>
          <Textarea
            id="cvr-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Pearl white, leather seats, sunroof…"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card/80 p-4">
        <p className="text-sm font-medium text-foreground">Your contact details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cvr-name">Full name *</Label>
            <Input
              id="cvr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cvr-email">Email *</Label>
            <Input
              id="cvr-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cvr-phone">Phone / WhatsApp *</Label>
            <Input
              id="cvr-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
        </div>

        <WhatsAppOptIn
          id="custom-request-whatsapp"
          phone={phone}
          checked={whatsappOptIn}
          onChange={setWhatsappOptIn}
          onTouchedChange={setWhatsappTouched}
        />

        {isGuest && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cvr-password">Create account password *</Label>
              <PasswordInput
                id="cvr-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cvr-confirm">Confirm password *</Label>
              <PasswordInput
                id="cvr-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-brand-purple hover:underline">
                Sign in
              </Link>{" "}
              to track this request.
            </p>
          </div>
        )}

        {user && profile?.registration_id && (
          <p className="text-xs text-muted-foreground">
            Linked to your account ({profile.registration_id}).
          </p>
        )}

        <CustomerDataTrustNote />
      </div>

      {feedback && (
        <p
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            feedback.ok
              ? "border border-brand-purple/30 bg-brand-purple/10 text-foreground"
              : "border border-destructive/30 bg-destructive/10 text-destructive"
          )}
          role="status"
        >
          {feedback.text}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-purple text-white hover:bg-brand-purple-dark"
      >
        {submitting ? "Submitting…" : "Submit custom vehicle request"}
      </Button>
    </form>
  );
}
