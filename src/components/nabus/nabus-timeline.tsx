import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type NabusTimelineStep = {
  title: string;
  description?: string;
  status?: "complete" | "current" | "upcoming";
};

type NabusTimelineProps = {
  steps: NabusTimelineStep[];
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export function NabusTimeline({
  steps,
  className,
  orientation = "horizontal",
}: NabusTimelineProps) {
  if (orientation === "vertical") {
    return (
      <ol className={cn("space-y-0", className)}>
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-[var(--nabus-border)]"
                aria-hidden
              />
            ) : null}
            <StepDot status={step.status} />
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-[var(--nabus-charcoal)]">{step.title}</p>
              {step.description ? (
                <p className="mt-1 text-sm text-[var(--nabus-text-secondary)]">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      className={cn(
        "grid gap-4",
        steps.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-5",
        className
      )}
    >
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex flex-col items-start sm:items-center sm:text-center">
          {index < steps.length - 1 ? (
            <span
              className="absolute left-[calc(50%+1rem)] top-4 hidden h-px w-[calc(100%-2rem)] bg-[var(--nabus-border)] sm:block lg:left-[calc(50%+1.25rem)]"
              aria-hidden
            />
          ) : null}
          <StepDot status={step.status} className="sm:mx-auto" />
          <p className="mt-3 text-sm font-semibold text-[var(--nabus-charcoal)]">{step.title}</p>
          {step.description ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--nabus-text-secondary)]">
              {step.description}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function StepDot({
  status = "upcoming",
  className,
}: {
  status?: NabusTimelineStep["status"];
  className?: string;
}) {
  const isComplete = status === "complete";
  const isCurrent = status === "current";

  return (
    <span
      className={cn(
        "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
        isComplete && "border-[var(--platform-success)] bg-[var(--platform-success)] text-white",
        isCurrent &&
          "border-[var(--nabus-primary)] bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]",
        !isComplete &&
          !isCurrent &&
          "border-[var(--nabus-border)] bg-[var(--nabus-surface)] text-[var(--nabus-text-secondary)]",
        className
      )}
    >
      {isComplete ? <Check className="size-4" strokeWidth={2.5} /> : null}
      {isCurrent ? (
        <span className="size-2 rounded-full bg-[var(--nabus-primary)]" aria-hidden />
      ) : null}
    </span>
  );
}
