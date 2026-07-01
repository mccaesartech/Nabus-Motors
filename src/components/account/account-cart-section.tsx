"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomerCartSummary } from "@/lib/parts/cart-types";
import { ROUTES } from "@/lib/routes";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountEmptyState } from "@/components/account/account-empty-state";

type AccountCartSectionProps = {
  cartSummary: CustomerCartSummary | null;
  loading: boolean;
};

export function AccountCartSection({ cartSummary, loading }: AccountCartSectionProps) {
  const hasItems = cartSummary && cartSummary.item_count > 0;

  return (
    <section id="my-cart" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4">
      <AccountSectionHeader
        icon={<ShoppingCart className="size-5" />}
        title="My Cart"
        description="Your saved cart syncs automatically when you are signed in."
        action={
          hasItems ? (
            <Button render={<Link href={ROUTES.auto.cart} />} className="min-h-11">
              View cart
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading cart…</p>
      ) : !hasItems ? (
        <AccountEmptyState
          icon={<ShoppingCart className="size-7" />}
          title="Your cart is empty"
          description="Browse vehicles and spare parts, add them to your cart, and checkout when you're ready."
          actionLabel="Browse vehicles"
          actionHref={ROUTES.auto.inventory}
        />
      ) : (
        <div className="rounded-xl border border-brand-purple/20 bg-gradient-to-br from-brand-purple/5 to-brand-gold/5 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {cartSummary.item_count} item{cartSummary.item_count === 1 ? "" : "s"} saved
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cartSummary.part_count > 0 && (
                  <>
                    {cartSummary.part_count} part{cartSummary.part_count === 1 ? "" : "s"}
                  </>
                )}
                {cartSummary.part_count > 0 && cartSummary.vehicle_count > 0 && " · "}
                {cartSummary.vehicle_count > 0 && (
                  <>
                    {cartSummary.vehicle_count} vehicle{cartSummary.vehicle_count === 1 ? "" : "s"}
                  </>
                )}
              </p>
              {cartSummary.updated_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last updated{" "}
                  {new Date(cartSummary.updated_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <Button render={<Link href={ROUTES.auto.cart} />} size="lg" className="min-h-12 w-full sm:w-auto">
              Open cart
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
