import { Container } from "@/components/shared/container";

export default function AccountLoading() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="mx-auto mt-8 max-w-4xl space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/20" />
      </div>
    </Container>
  );
}
