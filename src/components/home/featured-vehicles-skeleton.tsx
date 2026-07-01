import { Container } from "@/components/shared/container";

export function FeaturedVehiclesSkeleton() {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse border border-border bg-muted"
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
