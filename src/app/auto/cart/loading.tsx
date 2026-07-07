import { Container } from "@/components/shared/container";

export default function CartLoading() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mx-auto mt-6 max-w-5xl space-y-3">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/70" />
      </div>
      <ul className="mx-auto mt-8 max-w-5xl divide-y rounded-xl border border-border/70 bg-card shadow-luxury">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="flex animate-pulse flex-col gap-4 p-4 sm:flex-row sm:items-start"
          >
            <div className="size-14 shrink-0 rounded-lg bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
            <div className="h-8 w-20 rounded bg-muted sm:shrink-0" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
