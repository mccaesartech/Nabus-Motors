"use client";

import { useEffect } from "react";
import {
  Calendar,
  Fuel,
  Gauge,
  MapPin,
  Settings,
  Shield,
} from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatMileage, formatVehicleName } from "@/lib/format";
import { VehiclePriceSection } from "@/components/vehicle/vehicle-price-section";
import { ContactActions } from "@/components/vehicle/contact-actions";
import { FinancingCalculator } from "@/components/vehicle/financing-calculator";
import { AvailabilityBadge } from "@/components/vehicle/availability-badge";
import { PreorderForm } from "@/components/vehicle/preorder-form";
import { AddVehicleToCartButton } from "@/components/vehicle/add-vehicle-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGarage } from "@/hooks/use-garage";
import { useCurrency } from "@/context/currency-context";
import { downPaymentUsd, isPreOrderStatus } from "@/lib/vehicles/availability";

interface VehicleDetailSidebarProps {
  vehicle: Vehicle;
}

export function VehicleDetailSidebar({ vehicle }: VehicleDetailSidebarProps) {
  const { addRecent } = useGarage();
  const { formatPrice } = useCurrency();
  const showPreorder = isPreOrderStatus(vehicle.status);

  useEffect(() => {
    addRecent(vehicle.id);
  }, [vehicle.id, addRecent]);

  return (
    <div className="space-y-6">
      <div className="border border-border p-5 shadow-luxury">
        <div className="flex flex-wrap gap-2">
          <AvailabilityBadge status={vehicle.status ?? "available"} />
          {vehicle.featured && <Badge variant="featured">Featured</Badge>}
          {vehicle.condition === "Certified Pre-Owned" && (
            <Badge variant="verified">Verified</Badge>
          )}
        </div>

        <h1 className="mt-3 text-xl font-semibold leading-tight">
          {formatVehicleName(vehicle)}
        </h1>

        <div className="mt-3">
          <VehiclePriceSection usdAmount={vehicle.price} />
        </div>

        {showPreorder && (
          <div className="mt-4 rounded-md border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
              Pre-order — 25% down payment required
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {formatPrice(downPaymentUsd(vehicle.price))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Secure this vehicle with a deposit. Balance due before delivery.
            </p>
          </div>
        )}

        <Separator className="my-5" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" />
            <span>{formatMileage(vehicle.mileage)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span>{vehicle.year}</span>
          </div>
          <div className="flex items-center gap-2">
            <Fuel className="size-4 text-muted-foreground" />
            <span>{vehicle.fuelType}</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" />
            <span>{vehicle.transmission}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <span>{vehicle.engineSize}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <span>{vehicle.location}</span>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <AddVehicleToCartButton
            vehicle={vehicle}
            size="default"
            variant="default"
            className="flex-1"
          />
          {showPreorder && (
            <PreorderForm
              vehicle={vehicle}
              triggerClassName="flex-1"
            />
          )}
        </div>

        <ContactActions vehicle={vehicle} />
      </div>

      <FinancingCalculator price={vehicle.price} />
    </div>
  );
}
