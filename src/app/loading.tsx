import { Container } from "@/components/shared/container";

export default function RootLoading() {
  return (
    <div className="py-16 sm:py-20">
      <Container>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="mx-auto h-10 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="mt-12 aspect-[16/9] max-h-[28rem] animate-pulse bg-muted" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse border border-border bg-muted/40" />
          ))}
        </div>
      </Container>
    </div>
  );
}
