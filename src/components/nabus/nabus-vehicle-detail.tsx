"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { vehicleImagesFor } from "@/lib/data/vehicle-images";
import { resolveExteriorColor } from "@/lib/vehicles/vehicle-colors";
import { ExteriorColorValue } from "@/components/shared/vehicle-color-swatch";
import { NabusVehicleGallery } from "@/components/nabus/nabus-vehicle-gallery";
import { NabusDealSheet } from "@/components/nabus/nabus-deal-sheet";
import { NabusSpecStrip } from "@/components/nabus/nabus-spec-strip";
import { NabusFinanceCalculator } from "@/components/nabus/nabus-finance-calculator";
import { NabusOwnershipPack } from "@/components/nabus/nabus-ownership-pack";
import { AddVehicleToCartButton } from "@/components/vehicle/add-vehicle-to-cart-button";
import { VehicleInspectionSummary } from "@/components/vehicle/vehicle-inspection-summary";
import { VehicleWarrantyInfo } from "@/components/vehicle/vehicle-warranty-info";
import { VehicleTrustBadges } from "@/components/vehicle/vehicle-trust-badges";
import { useGarage } from "@/hooks/use-garage";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import { isPreOrderStatus } from "@/lib/vehicles/availability";
import { DEFAULT_TRUST_BADGES } from "@/lib/vehicles/trust-badges";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "story", label: "Vehicle Story" },
  { id: "specifications", label: "Specifications" },
  { id: "features", label: "Features" },
  { id: "finance", label: "Finance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type NabusVehicleDetailProps = {
  vehicle: Vehicle;
};

export function NabusVehicleDetail({ vehicle }: NabusVehicleDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>("story");
  const { addRecent } = useGarage();

  const images = useMemo(() => vehicleImagesFor(vehicle), [vehicle]);
  const specs = vehicle.specs ?? [];
  const history = vehicle.history ?? [];
  const showPreorder = isPreOrderStatus(vehicle.status);
  const vehicleName = formatVehicleName(vehicle);

  useEffect(() => {
    addRecent(vehicle.id);
    recordVehicleEngagement("view", vehicle);
  }, [vehicle, addRecent]);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0 space-y-6">
          <NabusVehicleGallery images={images} alt={vehicleName} />
          <NabusSpecStrip vehicle={vehicle} />

          <div className="border-b border-[var(--nabus-border)]">
            <div className="flex gap-1 overflow-x-auto pb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200",
                    activeTab === tab.id
                      ? "border-[var(--nabus-wine)] text-[var(--nabus-wine)]"
                      : "border-transparent text-[var(--nabus-muted)] hover:text-[var(--nabus-graphite)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="animate-in fade-in duration-200">
            {activeTab === "story" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--nabus-graphite)]">Vehicle Story</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--nabus-muted)]">
                    {vehicle.description}
                  </p>
                </div>
                {history.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--nabus-muted)]">
                      History
                    </h3>
                    <div className="mt-4 space-y-4">
                      {history.map((event, index) => (
                        <div key={index} className="border-l border-[var(--nabus-gold)] pl-4">
                          <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--nabus-muted)]">
                            {event.date}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--nabus-graphite)]">
                            {event.title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--nabus-muted)]">{event.description}</p>
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
                <h2 className="text-lg font-semibold text-[var(--nabus-graphite)]">Full Specifications</h2>
                <div className="mt-4 divide-y divide-[var(--nabus-border)] border-y border-[var(--nabus-border)]">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex justify-between py-3 text-sm">
                      <span className="text-[var(--nabus-muted)]">{spec.label}</span>
                      <span className="font-medium text-[var(--nabus-graphite)]">{spec.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 text-sm">
                    <span className="text-[var(--nabus-muted)]">Exterior Color</span>
                    <ExteriorColorValue color={resolveExteriorColor(vehicle)} />
                  </div>
                  <div className="flex justify-between py-3 text-sm">
                    <span className="text-[var(--nabus-muted)]">VIN</span>
                    <span className="max-w-[60%] break-all font-mono text-xs text-[var(--nabus-graphite)]">
                      {vehicle.vin}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "features" && (
              <div className="space-y-6">
                <VehicleTrustBadges
                  badges={vehicle.trustBadges ?? DEFAULT_TRUST_BADGES}
                  variant="inline"
                />
                <ul className="grid gap-2 sm:grid-cols-2">
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
                        "border px-4 py-3 text-sm",
                        item.active
                          ? "border-[var(--nabus-gold)]/40 bg-[var(--nabus-gold-soft)] text-[var(--nabus-graphite)]"
                          : "border-[var(--nabus-border)] text-[var(--nabus-muted)]"
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
                <h2 className="text-lg font-semibold text-[var(--nabus-graphite)]">Finance Options</h2>
                <p className="mt-2 text-sm text-[var(--nabus-muted)]">
                  Estimate your monthly payment. Final terms depend on approval.
                </p>
                <div className="mt-6 border border-[var(--nabus-border)] bg-[var(--nabus-paper)] p-6">
                  <NabusFinanceCalculator price={vehicle.price} collapsible={false} />
                </div>
                <Link
                  href={`${ROUTES.auto.financing}?vehicle=${vehicle.slug}`}
                  className="mt-4 inline-block text-sm font-semibold text-[var(--nabus-wine)] hover:underline"
                >
                  Open Finance Centre →
                </Link>
              </div>
            )}
          </div>
        </div>

        <NabusDealSheet vehicle={vehicle} className="hidden lg:block" />
      </div>

      <div className="mt-12">
        <NabusOwnershipPack tone="light" />
      </div>

      {/* Mobile sticky reserve bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--nabus-border)] bg-[var(--nabus-paper)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <AddVehicleToCartButton
          vehicle={vehicle}
          variant="default"
          size="default"
          className="h-12 w-full uppercase tracking-wide"
        />
        {showPreorder ? (
          <p className="mt-2 text-center text-[10px] text-[var(--nabus-muted)]">
            Import pre-order · 25% down payment
          </p>
        ) : null}
      </div>
      <div className="h-20 lg:hidden" aria-hidden />
    </>
  );
}
