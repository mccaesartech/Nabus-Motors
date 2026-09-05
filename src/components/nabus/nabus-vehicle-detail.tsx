"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Fuel,
  Gauge,
  MapPin,
  MessageCircle,
  Settings,
  Shield,
} from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { calculateMonthlyPayment, formatMileage, formatVehicleName } from "@/lib/format";
import { vehicleImagesFor } from "@/lib/data/vehicle-images";
import { resolveExteriorColor } from "@/lib/vehicles/vehicle-colors";
import { ExteriorColorValue } from "@/components/shared/vehicle-color-swatch";
import { NabusVehicleGallery } from "@/components/nabus/nabus-vehicle-gallery";
import { NabusStatusChip } from "@/components/nabus/nabus-status-chip";
import { VehiclePriceSection } from "@/components/vehicle/vehicle-price-section";
import { PreorderForm } from "@/components/vehicle/preorder-form";
import { AddVehicleToCartButton } from "@/components/vehicle/add-vehicle-to-cart-button";
import { VehicleInspectionSummary } from "@/components/vehicle/vehicle-inspection-summary";
import { VehicleWarrantyInfo } from "@/components/vehicle/vehicle-warranty-info";
import { VehicleTrustBadges } from "@/components/vehicle/vehicle-trust-badges";
import { FinancingCalculator } from "@/components/vehicle/financing-calculator";
import { useGarage } from "@/hooks/use-garage";
import { useCurrency } from "@/context/currency-context";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_GHANA_APR,
  FINANCING_TERM_MONTHS,
} from "@/lib/vehicles/financing-constants";
import {
  downPaymentUsd,
  isPreOrderStatus,
} from "@/lib/vehicles/availability";
import { DEFAULT_TRUST_BADGES } from "@/lib/vehicles/trust-badges";
import { GHANA_PHONE_TEL, GHANA_WHATSAPP } from "@/lib/data/vehicle-images";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "specifications", label: "Specifications" },
  { id: "features", label: "Features" },
  { id: "finance", label: "Finance" },
  { id: "delivery", label: "Delivery" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type NabusVehicleDetailProps = {
  vehicle: Vehicle;
};

export function NabusVehicleDetail({ vehicle }: NabusVehicleDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { addRecent } = useGarage();
  const { formatPrice } = useCurrency();

  const images = useMemo(() => vehicleImagesFor(vehicle), [vehicle]);
  const specs = vehicle.specs ?? [];
  const history = vehicle.history ?? [];
  const showPreorder = isPreOrderStatus(vehicle.status);
  const vehicleName = formatVehicleName(vehicle);

  const monthlyEstimate = calculateMonthlyPayment(
    vehicle.price,
    Math.round((vehicle.price * DEFAULT_DOWN_PAYMENT_PERCENT) / 100),
    DEFAULT_GHANA_APR,
    FINANCING_TERM_MONTHS[2]
  );

  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? GHANA_WHATSAPP;
  const whatsappMessage = encodeURIComponent(
    showPreorder
      ? `Hi, I'd like to enquire about the ${vehicleName}. Down payment: ${formatPrice(downPaymentUsd(vehicle.price))} (25%).`
      : `Hi, I'm interested in the ${vehicleName} (Stock #${vehicle.id}).`
  );

  useEffect(() => {
    addRecent(vehicle.id);
    recordVehicleEngagement("view", vehicle);
  }, [vehicle, addRecent]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0 space-y-6">
        <NabusVehicleGallery images={images} alt={vehicleName} />

        <div className="border-b border-[var(--nabus-border)]">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
                  activeTab === tab.id
                    ? "border-[var(--nabus-primary)] text-[var(--nabus-primary)]"
                    : "border-transparent text-[var(--nabus-text-secondary)] hover:text-[var(--nabus-charcoal)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in duration-200">
          {activeTab === "overview" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Description</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--nabus-text-secondary)]">
                  {vehicle.description}
                </p>
              </div>
              {history.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Vehicle History</h2>
                  <div className="mt-4 space-y-0">
                    {history.map((event, index) => (
                      <div key={index} className="flex gap-4 pb-6 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="size-2.5 rounded-full bg-[var(--nabus-primary)]" />
                          {index < history.length - 1 && (
                            <div className="mt-1 w-px flex-1 bg-[var(--nabus-border)]" />
                          )}
                        </div>
                        <div className="pb-2">
                          <p className="text-xs font-medium text-[var(--nabus-text-secondary)]">
                            {event.date}
                          </p>
                          <p className="text-sm font-semibold text-[var(--nabus-charcoal)]">
                            {event.title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--nabus-text-secondary)]">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <VehicleInspectionSummary vehicle={vehicle} />
              <VehicleWarrantyInfo vehicle={vehicle} />
            </div>
          )}

          {activeTab === "specifications" && (
            <div>
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Specifications</h2>
              <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-[var(--nabus-border)] sm:grid-cols-2">
                {specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex justify-between bg-[var(--nabus-surface)] px-4 py-3 text-sm"
                  >
                    <span className="text-[var(--nabus-text-secondary)]">{spec.label}</span>
                    <span className="font-medium text-[var(--nabus-charcoal)]">{spec.value}</span>
                  </div>
                ))}
                <div className="flex justify-between bg-[var(--nabus-surface)] px-4 py-3 text-sm">
                  <span className="text-[var(--nabus-text-secondary)]">Exterior Color</span>
                  <ExteriorColorValue color={resolveExteriorColor(vehicle)} />
                </div>
                <div className="flex justify-between bg-[var(--nabus-surface)] px-4 py-3 text-sm">
                  <span className="text-[var(--nabus-text-secondary)]">VIN</span>
                  <span className="max-w-[60%] break-all font-mono text-xs font-medium text-[var(--nabus-charcoal)]">
                    {vehicle.vin}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "features" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Trust & Quality</h2>
                <div className="mt-4">
                  <VehicleTrustBadges
                    badges={vehicle.trustBadges ?? DEFAULT_TRUST_BADGES}
                    variant="inline"
                  />
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Financing available", active: vehicle.financingAvailable !== false },
                  { label: "Shipment available", active: vehicle.shipmentAvailable !== false },
                  {
                    label: "Customs clearing support",
                    active: vehicle.customsClearingAvailable !== false,
                  },
                  { label: "Available locally in Ghana", active: Boolean(vehicle.availableLocally) },
                ].map((item) => (
                  <li
                    key={item.label}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm font-medium",
                      item.active
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-[var(--nabus-border)] bg-[var(--nabus-background)] text-[var(--nabus-text-secondary)]"
                    )}
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "finance" && (
            <div>
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Finance Options</h2>
              <p className="mt-2 text-sm text-[var(--nabus-text-secondary)]">
                Estimate your monthly payment. Final terms depend on approval.
              </p>
              <div className="mt-6">
                <FinancingCalculator price={vehicle.price} collapsible={false} />
              </div>
            </div>
          )}

          {activeTab === "delivery" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[var(--nabus-charcoal)]">Delivery & Availability</h2>
              <div className="rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-background)] p-5 text-sm">
                <p className="font-semibold text-[var(--nabus-charcoal)]">
                  Location: {vehicle.location}
                </p>
                {vehicle.availableLocally ? (
                  <p className="mt-2 text-[var(--nabus-text-secondary)]">
                    This vehicle is available locally in Ghana — ready for immediate delivery without
                    international shipping.
                  </p>
                ) : showPreorder ? (
                  <p className="mt-2 text-[var(--nabus-text-secondary)]">
                    Pre-order available with 25% down payment. We handle import, freight, and
                    clearing options during checkout.
                  </p>
                ) : (
                  <p className="mt-2 text-[var(--nabus-text-secondary)]">
                    Nationwide delivery available. Contact us for shipping timelines and clearing
                    support.
                  </p>
                )}
              </div>
              <Link
                href={ROUTES.corporate.freightTracking}
                className="inline-flex text-sm font-semibold text-[var(--nabus-primary)] hover:underline"
              >
                Track an existing shipment →
              </Link>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
        <div className="rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <NabusStatusChip status={vehicle.status ?? "available"} size="md" />
            {vehicle.featured ? (
              <span className="inline-flex items-center rounded-full border border-[var(--nabus-yellow)]/40 bg-[var(--nabus-yellow-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--nabus-charcoal)]">
                Featured
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-xl font-bold leading-tight text-[var(--nabus-charcoal)]">
            {vehicleName}
          </h1>

          <div className="mt-3">
            <VehiclePriceSection vehicle={vehicle} />
          </div>

          <p className="mt-3 text-sm text-[var(--nabus-text-secondary)]">
            Est.{" "}
            <span className="font-semibold tabular-nums text-[var(--nabus-charcoal)]">
              {formatPrice(Math.round(monthlyEstimate))}
            </span>
            /mo · {DEFAULT_DOWN_PAYMENT_PERCENT}% down · {FINANCING_TERM_MONTHS[2]} months
          </p>

          {showPreorder && (
            <div className="mt-4 rounded-lg border border-[var(--nabus-primary)]/20 bg-[var(--nabus-red-soft)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--nabus-primary)]">
                Pre-order — 25% down
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--nabus-charcoal)]">
                {formatPrice(downPaymentUsd(vehicle.price))}
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-[var(--nabus-text-secondary)]">
              <Gauge className="size-4 shrink-0" />
              {formatMileage(vehicle.mileage)}
            </div>
            <div className="flex items-center gap-2 text-[var(--nabus-text-secondary)]">
              <Calendar className="size-4 shrink-0" />
              {vehicle.year}
            </div>
            <div className="flex items-center gap-2 text-[var(--nabus-text-secondary)]">
              <Fuel className="size-4 shrink-0" />
              {vehicle.fuelType}
            </div>
            <div className="flex items-center gap-2 text-[var(--nabus-text-secondary)]">
              <Settings className="size-4 shrink-0" />
              {vehicle.transmission}
            </div>
            <div className="flex items-center gap-2 text-[var(--nabus-text-secondary)]">
              <Shield className="size-4 shrink-0" />
              {vehicle.engineSize}
            </div>
            <div className="flex items-center gap-2 text-[var(--nabus-text-secondary)]">
              <MapPin className="size-4 shrink-0" />
              {vehicle.location}
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <Link
              href={`/contact?vehicle=${vehicle.slug}`}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--nabus-primary)] text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--nabus-primary-hover)]"
            >
              Enquire Now
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--nabus-input-border)] bg-[var(--nabus-surface)] text-sm font-semibold text-[var(--nabus-charcoal)] transition-colors duration-200 hover:bg-[var(--nabus-background)]"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
            <Link
              href={ROUTES.auto.financing}
              className="flex h-11 w-full items-center justify-center rounded-lg border border-[var(--nabus-input-border)] bg-[var(--nabus-surface)] text-sm font-semibold text-[var(--nabus-charcoal)] transition-colors duration-200 hover:bg-[var(--nabus-background)]"
            >
              Finance Options
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <AddVehicleToCartButton vehicle={vehicle} className="flex-1" />
            {showPreorder ? (
              <PreorderForm vehicle={vehicle} triggerClassName="flex-1" />
            ) : null}
          </div>

          <a
            href={`tel:${GHANA_PHONE_TEL}`}
            className="mt-3 block text-center text-xs font-medium text-[var(--nabus-text-secondary)] hover:text-[var(--nabus-primary)]"
          >
            Or call us directly
          </a>
        </div>
      </aside>
    </div>
  );
}
