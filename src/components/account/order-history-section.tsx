"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import type { PartsOrderSummary } from "@/lib/parts/cart-types";
import { ROUTES } from "@/lib/routes";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountEmptyState } from "@/components/account/account-empty-state";
import { OrderCard } from "@/components/account/order-card";
import { isRecentOrder } from "@/lib/account/types";

type OrderHistorySectionProps = {
  orders: PartsOrderSummary[];
  loading: boolean;
  highlightRecent?: boolean;
};

export function OrderHistorySection({
  orders,
  loading,
  highlightRecent = true,
}: OrderHistorySectionProps) {
  const recentOrderId =
    highlightRecent && orders.find((o) => isRecentOrder(o.created_at))?.id;

  return (
    <section id="my-orders" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4">
      <AccountSectionHeader
        icon={<Package className="size-5" />}
        title="My Orders"
        description="Past purchases and quote requests from your cart — parts and vehicles."
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : orders.length === 0 ? (
        <AccountEmptyState
          icon={<Package className="size-7" />}
          title="No orders yet"
          description="When you checkout from your cart, your order will appear here with status updates and item details."
          actionLabel="Go to cart"
          actionHref={ROUTES.auto.cart}
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard
                order={order}
                highlight={order.id === recentOrderId}
                defaultExpanded={order.id === recentOrderId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
