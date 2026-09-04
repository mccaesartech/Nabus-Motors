import Link from "next/link";
import { ArrowRight, Car, Clock, Tag } from "lucide-react";
import { Container } from "@/components/shared/container";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  {
    href: ROUTES.auto.buy,
    label: "Buy",
    description: "Browse available vehicles and start your purchase.",
    icon: Car,
  },
  {
    href: ROUTES.auto.sell,
    label: "Sell",
    description: "Get a fair appraisal and sell through Nabus Motors.",
    icon: Tag,
  },
  {
    href: ROUTES.auto.preorder,
    label: "Pre-Order",
    description: "Reserve imports with a 25% down payment.",
    icon: Clock,
  },
] as const;

export function AutoQuickNav() {
  return (
    <section className="border-b border-border bg-muted/30 py-6 lg:hidden">
      <Container>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-icon-box-border bg-icon-box-bg">
                  <Icon className="size-4 text-icon-box-fg" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-purple">
                    Explore
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
