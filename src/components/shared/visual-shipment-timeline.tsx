"use client";

import {
  Anchor,
  Check,
  ClipboardCheck,
  FileCheck,
  FileText,
  PackageCheck,
  Search,
  Ship,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  QUOTE_VISUAL_STEPS,
  SHIPMENT_VISUAL_STEPS,
  isTerminalQuoteStatus,
  isTerminalShipmentStatus,
  quoteStatusStepIndex,
  shipmentStatusStepIndex,
} from "@/lib/platform/shipment";

type StepState = "completed" | "current" | "pending" | "cancelled";

type VisualShipmentTimelineProps = {
  mode?: "shipment" | "quote";
  status: string;
  referenceId?: string | null;
  trackingId?: string | null;
  expectedArrival?: string | null;
  size?: "default" | "mini";
  theme?: "brand" | "platform";
  className?: string;
};

const SHIPMENT_ICONS: LucideIcon[] = [
  ClipboardCheck,
  Sparkles,
  Ship,
  Anchor,
  ShieldCheck,
  PackageCheck,
];

const QUOTE_ICONS: LucideIcon[] = [FileText, Search, FileCheck, PackageCheck];

function getStepState(
  stepIndex: number,
  currentIndex: number,
  isTerminal: boolean,
  isCancelled: boolean
): StepState {
  if (isCancelled) return stepIndex === 0 ? "cancelled" : "pending";
  if (isTerminal) return "completed";
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

function formatArrival(date: string | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function VisualShipmentTimeline({
  mode = "shipment",
  status,
  referenceId,
  trackingId,
  expectedArrival,
  size = "default",
  theme = "brand",
  className,
}: VisualShipmentTimelineProps) {
  const isQuote = mode === "quote";
  const steps = isQuote ? QUOTE_VISUAL_STEPS : SHIPMENT_VISUAL_STEPS;
  const icons = isQuote ? QUOTE_ICONS : SHIPMENT_ICONS;
  const currentIndex = isQuote ? quoteStatusStepIndex(status) : shipmentStatusStepIndex(status);
  const isCancelled = status === "cancelled";
  const isTerminal = isQuote ? isTerminalQuoteStatus(status) : isTerminalShipmentStatus(status);
  const isMini = size === "mini";
  const isPlatform = theme === "platform";

  const arrivalLabel = formatArrival(expectedArrival);

  return (
    <div
      className={cn(
        "rounded-xl border",
        isPlatform
          ? "border-[var(--platform-border)] bg-[var(--platform-surface)]"
          : "border-border bg-gradient-to-br from-brand-purple/[0.04] to-brand-cta-gold/[0.06]",
        isMini ? "p-3" : "p-5 sm:p-6",
        className
      )}
    >
      {!isMini && (referenceId || trackingId || arrivalLabel) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {referenceId && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                isPlatform
                  ? "bg-[var(--platform-border)] text-[var(--platform-text)]"
                  : "bg-brand-purple/10 text-brand-purple"
              )}
            >
              <span className="opacity-70">Ref</span>
              <span className="font-mono">{referenceId}</span>
            </span>
          )}
          {trackingId && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                isPlatform
                  ? "bg-[var(--platform-accent)]/15 text-[var(--platform-accent)]"
                  : "bg-brand-purple/10 text-brand-purple"
              )}
            >
              <span className="opacity-70">Tracking</span>
              <span className="font-mono">{trackingId}</span>
            </span>
          )}
          {arrivalLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                isPlatform
                  ? "bg-[var(--platform-border)] text-[var(--platform-text-secondary)]"
                  : "bg-brand-cta-gold/15 text-brand-cta-gold-hover"
              )}
            >
              <span className="opacity-70">Expected arrival</span>
              <span>{arrivalLabel}</span>
            </span>
          )}
        </div>
      )}

      {isCancelled && (
        <p
          className={cn(
            "mb-4 text-xs font-medium",
            isPlatform ? "text-[var(--platform-error)]" : "text-destructive"
          )}
        >
          This {isQuote ? "quote" : "shipment"} has been cancelled.
        </p>
      )}

      <div
        className={cn(
          "overflow-x-auto pb-1",
          isMini ? "-mx-1 px-1" : "-mx-2 px-2"
        )}
      >
        <div
          className={cn(
            "flex min-w-max items-start",
            isMini ? "gap-0" : "gap-0 sm:min-w-0 sm:w-full"
          )}
          style={{ minWidth: isMini ? `${steps.length * 72}px` : `${steps.length * 100}px` }}
        >
          {steps.map((step, index) => {
            const state = getStepState(index, currentIndex, isTerminal, isCancelled);
            const Icon = icons[index] ?? PackageCheck;
            const isLast = index === steps.length - 1;

            return (
              <div
                key={step.status}
                className={cn(
                  "relative flex flex-1 flex-col items-center",
                  isMini ? "min-w-[4.5rem]" : "min-w-[5.5rem] sm:min-w-0"
                )}
              >
                {!isLast && (
                  <div
                    className={cn(
                      "absolute top-[calc(var(--node-size)/2)] h-0.5 -translate-y-1/2",
                      isMini
                        ? "left-[calc(50%+var(--node-size)/2)] right-[calc(-50%+var(--node-size)/2)]"
                        : "left-[calc(50%+var(--node-size)/2+2px)] right-[calc(-50%+var(--node-size)/2+2px)]",
                      !isCancelled && (isTerminal || index < currentIndex)
                        ? isPlatform
                          ? "bg-[var(--platform-accent)]"
                          : "bg-brand-cta-gold"
                        : isPlatform
                          ? "bg-[var(--platform-border)]"
                          : "bg-border"
                    )}
                    style={{ "--node-size": isMini ? "1.5rem" : "2.25rem" } as React.CSSProperties}
                  />
                )}

                <div
                  className={cn(
                    "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isMini ? "size-6" : "size-9",
                    state === "completed" &&
                      (isPlatform
                        ? "border-[var(--platform-accent)] bg-[var(--platform-accent)] text-white"
                        : "border-brand-cta-gold bg-brand-cta-gold text-white"),
                    state === "current" &&
                      (isPlatform
                        ? "border-[var(--platform-accent)] bg-[var(--platform-accent)]/15 text-[var(--platform-accent)] shadow-[0_0_0_4px_rgba(var(--platform-accent-rgb,139,92,246),0.2)] animate-pulse"
                        : "border-brand-purple bg-brand-purple/15 text-brand-purple shadow-[0_0_0_4px_rgba(139,92,246,0.2)] animate-pulse"),
                    state === "pending" &&
                      (isPlatform
                        ? "border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-secondary)]"
                        : "border-border bg-muted/50 text-muted-foreground"),
                    state === "cancelled" &&
                      (isPlatform
                        ? "border-[var(--platform-error)] bg-[var(--platform-error)]/10 text-[var(--platform-error)]"
                        : "border-destructive bg-destructive/10 text-destructive")
                  )}
                >
                  {state === "completed" ? (
                    <Check className={cn(isMini ? "size-3" : "size-4")} strokeWidth={3} />
                  ) : (
                    <Icon className={cn(isMini ? "size-3" : "size-4")} />
                  )}
                </div>

                <div className={cn("mt-2 flex flex-col items-center text-center", isMini ? "px-0.5" : "px-1")}>
                  <Icon
                    className={cn(
                      "mb-0.5",
                      isMini ? "size-3" : "size-3.5",
                      state === "completed"
                        ? isPlatform
                          ? "text-[var(--platform-accent)]"
                          : "text-brand-cta-gold"
                        : state === "current"
                          ? isPlatform
                            ? "text-[var(--platform-accent)]"
                            : "text-brand-purple"
                          : "text-muted-foreground/60"
                    )}
                  />
                  <span
                    className={cn(
                      "leading-tight",
                      isMini ? "text-[10px]" : "text-[11px] sm:text-xs",
                      state === "current"
                        ? "font-semibold text-foreground"
                        : state === "completed"
                          ? "font-medium text-foreground/80"
                          : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
