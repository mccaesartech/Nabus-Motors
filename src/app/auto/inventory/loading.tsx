import { Container } from "@/components/shared/container";

export default function InventoryLoading() {
  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8 space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="hidden h-96 w-64 shrink-0 animate-pulse rounded bg-muted/50 lg:block" />
          <div className="min-w-0 flex-1">
            <div className="mb-6 h-9 w-full max-w-xs animate-pulse rounded bg-muted/60" />
            <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden border border-border bg-card">
                  <div className="aspect-[4/3] animate-pulse bg-muted" />
                  <div className="space-y-2 p-5">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-5 w-1/3 animate-pulse rounded bg-muted/80" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
