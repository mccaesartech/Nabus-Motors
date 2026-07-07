"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { makes, modelsByMake } from "@/lib/data/catalog-meta";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 15 }, (_, i) => currentYear - i);

type WizardStep = "year" | "make" | "model";

type PartsFitmentWizardProps = {
  className?: string;
};

export function PartsFitmentWizard({ className }: PartsFitmentWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("year");
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");

  const availableModels = useMemo(
    () => (make ? modelsByMake[make] ?? [] : []),
    [make]
  );

  const stepIndex = step === "year" ? 0 : step === "make" ? 1 : 2;

  function goToMake() {
    if (!year) return;
    setStep("make");
  }

  function goToModel() {
    if (!make) return;
    setModel("");
    setStep("model");
  }

  function applyFitment() {
    if (!make || !model) return;
    const params = new URLSearchParams({ make, model });
    router.push(`${ROUTES.auto.spareParts}?${params.toString()}#parts-results`);
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-luxury sm:p-6",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Wrench className="size-5 text-brand-purple" />
        <div>
          <h2 className="text-sm font-semibold">Find parts for your vehicle</h2>
          <p className="text-xs text-muted-foreground">
            Select year, make, and model to filter compatible parts.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        {(["Year", "Make", "Model"] as const).map((label, index) => (
          <span key={label} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="size-3" />}
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                stepIndex === index
                  ? "bg-brand-purple/10 font-medium text-brand-purple"
                  : stepIndex > index
                    ? "text-foreground"
                    : ""
              )}
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-5">
        {step === "year" && (
          <div className="space-y-4 sm:max-w-xs">
            <div className="space-y-1.5">
              <Label htmlFor="fitment-year">Vehicle year</Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
                <SelectTrigger id="fitment-year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" disabled={!year} onClick={goToMake}>
              Next: Make
            </Button>
          </div>
        )}

        {step === "make" && (
          <div className="space-y-4 sm:max-w-xs">
            <p className="text-xs text-muted-foreground">
              Selected year: <span className="font-medium text-foreground">{year}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="fitment-make">Make</Label>
              <Select
                value={make}
                onValueChange={(v) => {
                  setMake(v ?? "");
                  setModel("");
                }}
              >
                <SelectTrigger id="fitment-make">
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent>
                  {makes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("year")}>
                Back
              </Button>
              <Button type="button" disabled={!make} onClick={goToModel}>
                Next: Model
              </Button>
            </div>
          </div>
        )}

        {step === "model" && (
          <div className="space-y-4 sm:max-w-xs">
            <p className="text-xs text-muted-foreground">
              {year} {make}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="fitment-model">Model</Label>
              <Select value={model} onValueChange={(v) => setModel(v ?? "")}>
                <SelectTrigger id="fitment-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("make")}>
                Back
              </Button>
              <Button type="button" disabled={!model} onClick={applyFitment}>
                Show compatible parts
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
