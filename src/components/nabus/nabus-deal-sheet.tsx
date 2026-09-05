"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, ShieldCheck } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { calculateMonthlyPayment, formatVehicleName } from "@/lib/format";
import { VehiclePriceSection } from "@/components/vehicle/vehicle-price-section";
import { PreorderForm } from "@/components/vehicle/preorder-form";
import { AddVehicleToCartButton } from "@/components/vehicle/add-vehicle-to-cart-button";
import { useCurrency } from "@/context/currency-context";
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_GHANA_APR,
  FINANCING_TERM_MONTHS,
} from "@/lib/vehicles/financing-constants";
import { downPaymentUsd, isPreOrderStatus } from "@/lib/vehicles/availability";
import { GHANA_WHATSAPP } from "@/lib/data/vehicle-images";
import { ROUTES } from "@/lib/routes";
import { NabusStatusChip } from "./nabus-status-chip";
import { cn } from "@/lib/utils";

type NabusDealSheetProps = {
  vehicle: Vehicle;
  className?: string;
  sticky?: boolean;
};

export function NabusDealSheet({ vehicle, className, sticky = true }: NabusDealSheetProps) {
  const { formatPrice } = useCurrency();
  const showPreorder = isPreOrderStatus(vehicle.status);
  const vehicleName = formatVehicleName(vehicle);

  const monthlyEstimate = useMemo(
    () =>
      calculateMonthlyPayment(
        vehicle.price,
        Math.round((vehicle.price * DEFAULT_DOWN_PAYMENT_PERCENT) / 100),
        DEFAULT_GHANA_APR,
        FINANCING_TERM_MONTHS[2]
      ),
    [vehicle.price]
  );

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? GHANA_WHATSAPP;
  const whatsappMessage = encodeURIComponent(
    showPreorder
      ? `Hi, I'd like to reserve the ${vehicleName}. Down payment: ${formatPrice(downPaymentUsd(vehicle.price))} (25%).`
      : `Hi, I'm interested in the ${vehicleName}. I'd like to request an inspection.`
  );

  return (
    <aside
      className={cn(
        "border-l border-[var(--nabus-gold)] bg-[var(--nabus-paper)] p-6 sm:p-8",
        sticky && "lg:sticky lg:top-[calc(var(--shell-top-offset)+1.5rem)]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <NabusStatusChip status={vehicle.status ?? "available"} />
          <h1 className="font-display mt-3 text-2xl leading-[1.15] text-[var(--nabus-graphite)] sm:text-3xl">
            {vehicleName}
          </h1>
        </div>
        <ShieldCheck className="size-5 shrink-0 text-[var(--nabus-gold)]" aria-hidden />
      </div>

      <div className="mt-5">
        <VehiclePriceSection vehicle={vehicle} />
      </div>

      {!showPreorder && vehicle.price > 0 ? (
        <p className="mt-3 font-mono text-xs text-[var(--nabus-muted)]">
          From{" "}
          <span className="text-[var(--nabus-gold)]">
            {formatPrice(monthlyEstimate)}
          </span>
          /mo ·{" "}
          <Link
            href={`${ROUTES.auto.financing}?vehicle=${vehicle.slug}`}
            className="underline decoration-[var(--nabus-border)] underline-offset-2 hover:text-[var(--nabus-graphite)]"
          >
            Finance options
          </Link>
        </p>
      ) : null}

      <div className="mt-6 space-y-2">
        <AddVehicleToCartButton vehicle={vehicle} variant="default" size="default" className="h-11" />
        {showPreorder ? (
          <PreorderForm vehicle={vehicle} triggerLabel="Reserve Import" triggerClassName="w-full" />
        ) : (
          <Link
            href={`${ROUTES.corporate.contact}?vehicle=${vehicle.slug}&intent=inspection`}
            className="inline-flex h-11 w-full items-center justify-center border border-[var(--nabus-border)] bg-transparent text-sm font-semibold uppercase tracking-wide text-[var(--nabus-graphite)] transition-colors duration-200 hover:border-[var(--nabus-wine)] hover:text-[var(--nabus-wine)]"
          >
            Request Inspection
          </Link>
        )}
        <a
          href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 w-full items-center justify-center gap-2 border border-[var(--nabus-border)] text-sm font-semibold text-[var(--nabus-graphite)] transition-colors duration-200 hover:border-[var(--nabus-gold)] hover:text-[var(--nabus-wine)]"
        >
          <MessageCircle className="size-4" />
          WhatsApp
        </a>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--nabus-muted)]">
        Reserve holds this vehicle while our team confirms availability. No payment required online.
      </p>
    </aside>
  );
}
