"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type NabusWizardStep = {
  id: string;
  label: string;
};

type NabusStepWizardProps = {
  steps: NabusWizardStep[];
  currentStep: number;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  showNav?: boolean;
  isNextDisabled?: boolean;
  isSubmitting?: boolean;
  className?: string;
};

export function NabusStepWizard({
  steps,
  currentStep,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  showNav = true,
  isNextDisabled = false,
  isSubmitting = false,
  className,
}: NabusStepWizardProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <nav aria-label="Progress">
        <ol className="flex items-center gap-1 sm:gap-2">
          {steps.map((step, index) => {
            const complete = index < currentStep;
            const current = index === currentStep;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors duration-200 sm:size-8",
                    complete &&
                      "border-green-600 bg-green-600 text-white",
                    current &&
                      "border-[var(--nabus-primary)] bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]",
                    !complete &&
                      !current &&
                      "border-[var(--nabus-border)] bg-[var(--nabus-surface)] text-[var(--nabus-text-secondary)]"
                  )}
                >
                  {complete ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-xs font-semibold sm:block",
                    current
                      ? "text-[var(--nabus-charcoal)]"
                      : "text-[var(--nabus-text-secondary)]"
                  )}
                >
                  {step.label}
                </span>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "mx-1 hidden h-px flex-1 sm:block",
                      complete ? "bg-green-600/40" : "bg-[var(--nabus-border)]"
                    )}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-center text-sm font-semibold text-[var(--nabus-charcoal)] sm:hidden">
          Step {currentStep + 1}: {steps[currentStep]?.label}
        </p>
      </nav>

      <div className="rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-5 sm:p-8">
        {children}
      </div>

      {showNav ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onBack && currentStep > 0 ? (
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="rounded-lg border border-[var(--nabus-input-border)] px-5 py-2.5 text-sm font-semibold text-[var(--nabus-charcoal)] transition-colors duration-200 hover:bg-[var(--nabus-background)] disabled:opacity-50"
            >
              {backLabel}
            </button>
          ) : (
            <span />
          )}
          {onNext ? (
            <button
              type="button"
              onClick={onNext}
              disabled={isNextDisabled || isSubmitting}
              className="ml-auto rounded-lg bg-[var(--nabus-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--nabus-primary-hover)] disabled:opacity-50"
            >
              {isSubmitting ? "Submitting…" : nextLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
