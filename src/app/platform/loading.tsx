export default function PlatformLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--platform-bg-secondary)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-[var(--platform-bg-secondary)]"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[var(--platform-bg-secondary)]" />
    </div>
  );
}
