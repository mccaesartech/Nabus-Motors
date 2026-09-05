import { cn } from "@/lib/utils";

type NabusSkeletonProps = {
  className?: string;
};

export function NabusSkeleton({ className }: NabusSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--nabus-border)]/60",
        className
      )}
      aria-hidden
    />
  );
}

export function NabusCardSkeleton({ className }: NabusSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-5",
        className
      )}
    >
      <NabusSkeleton className="h-4 w-24" />
      <NabusSkeleton className="mt-3 h-8 w-16" />
      <NabusSkeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function NabusTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)]">
      <div className="border-b border-[var(--nabus-border)] bg-[var(--nabus-background)] px-4 py-3">
        <NabusSkeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[var(--nabus-border)] px-4 py-3 last:border-0"
        >
          <NabusSkeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <NabusSkeleton className="h-4 w-3/5" />
            <NabusSkeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
