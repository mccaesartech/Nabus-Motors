"use client";

import Link from "next/link";
import { CheckCircle2, CalendarCheck } from "lucide-react";
import type { PartsOrderSummary } from "@/lib/parts/cart-types";
import { isRecentOrder, orderReferenceId } from "@/lib/account/types";
import { useCurrency } from "@/context/currency-context";
import { orderStatusLabel } from "@/lib/parts/order-labels";
import { Button } from "@/components/ui/button";

type RecentOrderBannerProps = {
  orders: PartsOrderSummary[];
};

export function RecentOrderBanner({ orders }: RecentOrderBannerProps) {
  const { formatPrice } = useCurrency();
  const recent = orders.find((order) => isRecentOrder(order.created_at));

  if (!recent) return null;

  const refId = orderReferenceId(recent.id);
  const vehicleItems = recent.items?.filter((item) => item.item_type === "vehicle") ?? [];
  const vehicleNames = vehicleItems.map((item) => item.name).slice(0, 2);
  const extraVehicles = vehicleItems.length - vehicleNames.length;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 to-brand-purple/5 px-5 py-5 dark:from-emerald-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Your recent order
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              Order confirmed · Ref {refId}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {orderStatusLabel(recent.status)} · {formatPrice(recent.total_usd)}
              {vehicleNames.length > 0 && (
                <>
                  {" "}
                  · {vehicleNames.join(", ")}
                  {extraVehicles > 0 ? ` +${extraVehicles} more` : ""}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="#my-orders" />}
            variant="outline"
            className="min-h-11 border-emerald-600/30 bg-white/80"
          >
            View order details
          </Button>
          <Button render={<Link href="#book-visit" />} className="min-h-11 gap-2">
            <CalendarCheck className="size-4" />
            Book a visit
          </Button>
        </div>
      </div>
    </div>
  );
}
