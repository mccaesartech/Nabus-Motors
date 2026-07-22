import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { VehicleSearch } from "@/components/home/vehicle-search";
import { CheckCircle2 } from "lucide-react";
import { getSiteContent } from "@/lib/site-content";

export const metadata = {
  title: "Buy a Vehicle",
  description:
    "Find your next vehicle with verified inventory, transparent pricing, and professional support.",
};

const steps = [
  "Browse our verified inventory online or visit our showroom",
  "Review detailed inspection reports and vehicle history",
  "Schedule a test drive or virtual walkthrough",
  "Secure financing with competitive rates",
  "Complete purchase with nationwide delivery available",
];

export default async function BuyPage() {
  const content = await getSiteContent();
  const hero = content.buy;

  return (
    <>
      <section className="bg-brand-primary py-16 sm:py-20">
        <Container>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{hero.title}</h1>
          <p className="mt-4 max-w-xl text-base text-on-dark-secondary">{hero.subtitle}</p>
        </Container>
      </section>

      <VehicleSearch />

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold">How It Works</h2>
              <ol className="mt-6 space-y-4">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-charcoal text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border border-border bg-muted/50 p-6">
              <h3 className="text-sm font-semibold">What You Get</h3>
              <ul className="mt-4 space-y-3">
                {[
                  "150-point inspection on every vehicle",
                  "Transparent pricing with no hidden fees",
                  "Pre-order available — 25% down payment to reserve",
                  "Flexible financing options",
                  "Nationwide delivery available",
                  "Post-purchase support",
                ].map((item) => (
                  <li key={item} className="flex gap-2 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="mt-6" render={<Link href={ROUTES.auto.inventory} />}>
                Browse Inventory
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
