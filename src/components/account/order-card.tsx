"use client";

import Image from "next/image";
import { Car, Package, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCurrency } from "@/context/currency-context";
import { orderStatusLabel } from "@/lib/parts/order-labels";
import type { PartsOrderSummary } from "@/lib/parts/cart-types";
import { orderReferenceId } from "@/lib/account/types";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type OrderItemRowProps = {
  item: NonNullable<PartsOrderSummary["items"]>[number];
};

function OrderItemRow({ item }: OrderItemRowProps) {
  const { formatPrice } = useCurrency();
  const Icon = item.item_type === "vehicle" ? Car : Package;
  const detailHref =
    item.slug &&
    (item.item_type === "vehicle"
      ? ROUTES.auto.inventoryDetail(item.slug)
      : ROUTES.auto.sparePartDetail(item.slug));

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted/40">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-brand-purple/60">
            <Icon className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {detailHref ? (
          <Link href={detailHref} className="font-medium text-foreground hover:text-brand-purple">
            {item.name}
          </Link>
        ) : (
          <span className="font-medium">{item.name}</span>
        )}
        <p className="text-xs text-muted-foreground">
          {item.item_type === "vehicle"
            ? item.item_intent === "pre_order"
              ? "Vehicle · Pre-order"
              : "Vehicle · Buy"
            : item.sku
              ? `Part · SKU ${item.sku}`
              : "Spare part"}
          {item.item_type === "part" && item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium">{formatPrice(item.unit_price_usd * item.quantity)}</span>
    </li>
  );
}

type OrderCardProps = {
  order: PartsOrderSummary;
  defaultExpanded?: boolean;
  highlight?: boolean;
};

export function OrderCard({ order, defaultExpanded = false, highlight = false }: OrderCardProps) {
  const { formatPrice } = useCurrency();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const refId = orderReferenceId(order.id);
  const orderDate = new Date(order.created_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        highlight
          ? "border-brand-purple/40 ring-2 ring-brand-purple/20"
          : "border-border/80"
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">{orderDate}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">Ref {refId}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.item_count} item{order.item_count === 1 ? "" : "s"} ·{" "}
            <span className="font-medium text-foreground">{formatPrice(order.total_usd)}</span>
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
            order.status === "confirmed"
              ? "bg-emerald-100 text-emerald-800"
              : order.status === "pending"
                ? "bg-brand-purple/10 text-brand-purple"
                : "bg-muted text-muted-foreground"
          )}
        >
          {orderStatusLabel(order.status)}
        </span>
      </div>

      {order.items && order.items.length > 0 && (
        <>
          <ul className="divide-y border-t bg-muted/20 text-sm">
            {(expanded ? order.items : order.items.slice(0, 2)).map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </ul>
          {order.items.length > 2 && (
            <div className="border-t px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 w-full gap-1.5 text-brand-purple"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="size-4" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    View all {order.items.length} items
                  </>
                )}
              </Button>
            </div>
          )}
          {order.items.length <= 2 && (
            <div className="border-t px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 w-full gap-1.5 text-brand-purple"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="size-4" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    View details
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
