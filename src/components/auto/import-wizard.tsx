"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/shared/container";
import { NabusPageHeader } from "@/components/nabus/nabus-page-header";
import { NabusStepWizard } from "@/components/nabus/nabus-step-wizard";
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
import type { PageHeroSiteContent } from "@/lib/site-content/defaults";

const WIZARD_STEPS = [
  { id: "vehicle", label: "Vehicle" },
  { id: "preferences", label: "Preferences" },
  { id: "budget", label: "Budget" },
  { id: "details", label: "Customer Details" },
  { id: "review", label: "Review" },
];

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

type ImportWizardProps = {
  hero: PageHeroSiteContent;
};

export function ImportWizard({ hero }: ImportWizardProps) {
  const { user, profile, displayName, getAccessToken, refreshProfile } = useCustomerAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);

  const [make, setMake] = useState("");
  const [makeOther, setMakeOther] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [condition, setCondition] = useState("");
  const [preferredTimeline, setPreferredTimeline] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState(displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappTouched, setWhatsappTouched] = useState(false);

  const isGuest = !user;
  const effectiveMake = make === "Other" ? makeOther.trim() : make.trim();

  function validateStep(index: number): string | null {
    if (index === 0) {
      if (!effectiveMake || !model.trim()) return "Make and model are required.";
    }
    if (index === 3) {
      if (!name.trim() || !email.trim()) return "Name and email are required.";
      if (!phone.trim()) return "Phone number is required.";
      if (isGuest) {
        if (!password || password.length < 8) return "Password must be at least 8 characters.";
        if (password !== confirmPassword) return "Passwords do not match.";
      }
    }
    return null;
  }

  async function handleSubmit() {
    const err = validateStep(3);
    if (err) {
      setFeedback({ ok: false, text: err });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

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

      setReferenceCode(json.referenceCode ?? null);
      setFeedback({ ok: true, text: json.message ?? "Request submitted." });
      if (json.registrationId) await refreshProfile();
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    const err = validateStep(step);
    if (err) {
      setFeedback({ ok: false, text: err });
      return;
    }
    setFeedback(null);
    if (step === WIZARD_STEPS.length - 1) {
      void handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  }

  if (referenceCode) {
    return (
      <Container className="py-10 sm:py-14">
        <div className="mx-auto max-w-lg rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-green-600" />
          <h2 className="mt-4 text-xl font-bold text-[var(--nabus-charcoal)]">Import request submitted</h2>
          <p className="mt-2 font-mono text-lg font-semibold text-[var(--nabus-primary)]">
            {referenceCode}
          </p>
          {feedback?.text ? (
            <p className="mt-3 text-sm text-[var(--nabus-text-secondary)]">{feedback.text}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/account?section=vehicle-requests#vehicle-requests"
              className="rounded-lg bg-[var(--nabus-primary)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Track in account
            </Link>
            <Link
              href={ROUTES.auto.inventory}
              className="rounded-lg border border-[var(--nabus-input-border)] px-5 py-2.5 text-sm font-semibold"
            >
              Browse inventory
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10 sm:py-14">
      <NabusPageHeader
        eyebrow="Import"
        title={hero.title}
        description={hero.subtitle}
        className="mb-8"
      />

      <div className="mx-auto max-w-2xl">
        <NabusStepWizard
          steps={WIZARD_STEPS}
          currentStep={step}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={handleNext}
          nextLabel={step === WIZARD_STEPS.length - 1 ? "Submit Request" : "Continue"}
          isSubmitting={submitting}
        >
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">What vehicle do you want?</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="import-make">Make</Label>
                  <Select value={make} onValueChange={(v) => setMake(v ?? "")}>
                    <SelectTrigger id="import-make">
                      <SelectValue placeholder="Select make" />
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
                </div>
                {make === "Other" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="import-make-other">Make name</Label>
                    <Input
                      id="import-make-other"
                      value={makeOther}
                      onChange={(e) => setMakeOther(e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="import-model">Model</Label>
                  <Input
                    id="import-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="import-year">Year (optional)</Label>
                  <Input
                    id="import-year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Preferences</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Body type</Label>
                  <Select value={bodyType} onValueChange={(v) => setBodyType(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fuel type</Label>
                  <Select value={fuelType} onValueChange={(v) => setFuelType(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
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
                  <Label>Timeline</Label>
                  <Select
                    value={preferredTimeline}
                    onValueChange={(v) => setPreferredTimeline(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="When do you need it?" />
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
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Budget</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="budget-min">Minimum (USD)</Label>
                  <Input
                    id="budget-min"
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="e.g. 15000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget-max">Maximum (USD)</Label>
                  <Input
                    id="budget-max"
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="e.g. 35000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-notes">Additional notes</Label>
                <Textarea
                  id="import-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Trim, color, must-have features…"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Your details</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="import-name">Full name</Label>
                  <Input
                    id="import-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="import-email">Email</Label>
                  <Input
                    id="import-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="import-phone">Phone</Label>
                  <Input
                    id="import-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              {isGuest ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="import-password">Password</Label>
                    <PasswordInput
                      id="import-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="import-confirm">Confirm password</Label>
                    <PasswordInput
                      id="import-confirm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                    />
                  </div>
                </div>
              ) : null}
              <WhatsAppOptIn
                phone={phone}
                checked={whatsappOptIn}
                onChange={setWhatsappOptIn}
                onTouchedChange={setWhatsappTouched}
              />
              <CustomerDataTrustNote />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-sm">
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Review your request</h2>
              <dl className="divide-y divide-[var(--nabus-border)] rounded-lg border border-[var(--nabus-border)]">
                {[
                  ["Vehicle", `${effectiveMake} ${model}${year ? ` (${year})` : ""}`],
                  ["Preferences", [bodyType, fuelType, condition, preferredTimeline].filter(Boolean).join(" · ") || "—"],
                  ["Budget", budgetMin || budgetMax ? `$${budgetMin || "0"} – $${budgetMax || "—"}` : "—"],
                  ["Contact", `${name} · ${email} · ${phone}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-[var(--nabus-text-secondary)]">{label}</dt>
                    <dd className="text-right font-medium text-[var(--nabus-charcoal)]">{value}</dd>
                  </div>
                ))}
              </dl>
              {notes ? (
                <p className="text-[var(--nabus-text-secondary)]">
                  <span className="font-semibold text-[var(--nabus-charcoal)]">Notes:</span> {notes}
                </p>
              ) : null}
            </div>
          )}

          {feedback && !feedback.ok ? (
            <p className="mt-4 text-sm text-red-600">{feedback.text}</p>
          ) : null}
        </NabusStepWizard>

        <p className="mt-8 text-center text-sm text-[var(--nabus-text-secondary)]">
          Prefer browsing first?{" "}
          <Link href={ROUTES.auto.inventory} className="font-semibold text-[var(--nabus-primary)] hover:underline">
            View inventory
          </Link>
        </p>
      </div>
    </Container>
  );
}
