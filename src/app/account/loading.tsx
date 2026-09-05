import { NabusCardSkeleton } from "@/components/nabus/nabus-skeleton";

export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--nabus-border)]/60" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-[var(--nabus-border)]/40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <NabusCardSkeleton key={i} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-border)]/30" />
    </div>
  );
}
