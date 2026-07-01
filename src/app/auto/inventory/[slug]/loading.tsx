import { Container } from "@/components/shared/container";

export default function VehicleDetailLoading() {
  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-6 h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-10">
            <div className="aspect-[16/10] animate-pulse bg-muted" />
            <div className="space-y-3">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-32 animate-pulse bg-muted/60" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-80 animate-pulse border border-border bg-muted/30" />
            <div className="h-64 animate-pulse border border-border bg-muted/20" />
          </div>
        </div>
      </Container>
    </div>
  );
}
