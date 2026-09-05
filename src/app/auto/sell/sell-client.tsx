"use client";

import { useState } from "react";
import { Container } from "@/components/shared/container";
import { NabusPageHeader } from "@/components/nabus/nabus-page-header";
import { NabusStepWizard } from "@/components/nabus/nabus-step-wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Upload } from "lucide-react";
import type { PageHeroSiteContent } from "@/lib/site-content/defaults";

const WIZARD_STEPS = [
  { id: "vehicle", label: "Vehicle" },
  { id: "condition", label: "Condition" },
  { id: "photos", label: "Photos" },
  { id: "owner", label: "Owner Details" },
  { id: "review", label: "Review" },
];

type SellPageClientProps = {
  hero: PageHeroSiteContent;
};

export function SellPageClient({ hero }: SellPageClientProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("");
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [notes, setNotes] = useState("");

  function validateStep(index: number): string | null {
    if (index === 0) {
      if (!make.trim() || !model.trim() || !year.trim() || !mileage.trim()) {
        return "Complete all vehicle fields.";
      }
    }
    if (index === 1 && !condition) return "Select vehicle condition.";
    if (index === 3) {
      if (!sellerName.trim() || !sellerPhone.trim()) return "Name and phone are required.";
    }
    return null;
  }

  async function handleSubmit() {
    const err = validateStep(3);
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");

    const photoNote =
      photoNames.length > 0
        ? `Photos attached (local only, not uploaded): ${photoNames.join(", ")}`
        : "";
    const combinedNotes = [notes.trim(), photoNote].filter(Boolean).join("\n\n");

    const res = await fetch("/api/inquiries/appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        make: make.trim(),
        model: model.trim(),
        year,
        mileage,
        condition,
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim(),
        notes: combinedNotes || undefined,
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError("Could not submit. Please try again or call us.");
    }
    setLoading(false);
  }

  function handleNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step === WIZARD_STEPS.length - 1) {
      void handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  }

  if (submitted) {
    return (
      <>
        <section className="bg-[var(--nabus-primary)] py-12 sm:py-16">
          <Container>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">{hero.title}</h1>
          </Container>
        </section>
        <Container className="py-14">
          <div className="mx-auto max-w-md rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-green-600" />
            <h2 className="mt-4 text-xl font-bold text-[var(--nabus-charcoal)]">
              Appraisal Request Received
            </h2>
            <p className="mt-2 text-sm text-[var(--nabus-text-secondary)]">
              We will review your vehicle details and contact you within one business day with an
              initial valuation.
            </p>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <section className="bg-[var(--nabus-primary)] py-12 sm:py-16">
        <Container>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">{hero.title}</h1>
          <p className="mt-3 max-w-xl text-base text-white/85">{hero.subtitle}</p>
        </Container>
      </section>

      <Container className="py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <NabusStepWizard
            steps={WIZARD_STEPS}
            currentStep={step}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            onNext={handleNext}
            nextLabel={step === WIZARD_STEPS.length - 1 ? "Submit for Appraisal" : "Continue"}
            isSubmitting={loading}
          >
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Your vehicle</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sell-make">Make</Label>
                    <Input id="sell-make" value={make} onChange={(e) => setMake(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sell-model">Model</Label>
                    <Input id="sell-model" value={model} onChange={(e) => setModel(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sell-year">Year</Label>
                    <Input id="sell-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sell-mileage">Mileage</Label>
                    <Input id="sell-mileage" type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} required />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Condition</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="sell-condition">Overall condition</Label>
                  <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
                    <SelectTrigger id="sell-condition">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Excellent", "Good", "Fair", "Needs Work"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Photos</h2>
                <p className="text-sm text-[var(--nabus-text-secondary)]">
                  Add photos to help us value your vehicle. Files stay on your device — we will
                  request uploads during follow-up if needed.
                </p>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--nabus-border)] bg-[var(--nabus-background)] px-6 py-10 transition-colors duration-200 hover:border-[var(--nabus-primary)]/40">
                  <Upload className="size-8 text-[var(--nabus-text-secondary)]" />
                  <span className="mt-2 text-sm font-semibold text-[var(--nabus-charcoal)]">
                    Choose photos
                  </span>
                  <span className="mt-1 text-xs text-[var(--nabus-text-secondary)]">Optional</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const names = Array.from(e.target.files ?? []).map((f) => f.name);
                      setPhotoNames(names);
                    }}
                  />
                </label>
                {photoNames.length > 0 ? (
                  <p className="text-sm text-[var(--nabus-text-secondary)]">
                    {photoNames.length} file{photoNames.length !== 1 ? "s" : ""} selected:{" "}
                    {photoNames.join(", ")}
                  </p>
                ) : null}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Owner details</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="seller-name">Your name</Label>
                    <Input id="seller-name" value={sellerName} onChange={(e) => setSellerName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seller-phone">Phone</Label>
                    <Input id="seller-phone" type="tel" value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seller-notes">Additional details</Label>
                  <Textarea id="seller-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 text-sm">
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Review</h2>
                <dl className="divide-y divide-[var(--nabus-border)] rounded-lg border border-[var(--nabus-border)]">
                  {[
                    ["Vehicle", `${year} ${make} ${model}`],
                    ["Mileage", mileage],
                    ["Condition", condition],
                    ["Contact", `${sellerName} · ${sellerPhone}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 px-4 py-3">
                      <dt className="text-[var(--nabus-text-secondary)]">{label}</dt>
                      <dd className="font-medium text-[var(--nabus-charcoal)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </NabusStepWizard>
        </div>
      </Container>
    </>
  );
}
