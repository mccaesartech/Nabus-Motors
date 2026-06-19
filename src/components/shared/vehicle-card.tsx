"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Fuel, Gauge, Heart, MapPin } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatMileage, formatPrice, formatVehicleName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGarage } from "@/hooks/use-garage";
import { cn } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Vehicle;
  className?: string;
}

function isPremiumVehicle(vehicle: Vehicle) {
  return (
    vehicle.featured ||
    vehicle.bodyType === "Luxury" ||
    vehicle.condition === "Certified Pre-Owned"
  );
}

export function VehicleCard({ vehicle, className }: VehicleCardProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const { isSaved, toggleSave } = useGarage();
  const saved = isSaved(vehicle.id);
  const premium = isPremiumVehicle(vehicle);
  const photo = primaryPhotoFor(vehicle);

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden border bg-white shadow-luxury transition-all duration-300 hover:shadow-luxury-lg",
          premium
            ? "border-brand-gold/50 hover:border-brand-gold"
            : "border-border hover:border-brand-purple/30",
          className
        )}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Link href={`/inventory/${vehicle.slug}`} className="block overflow-hidden">
            <SafeVehicleImage
              src={photo}
              alt={formatVehicleName(vehicle)}
              className="transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          </Link>
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {vehicle.featured && (
              <Badge variant="featured">Featured</Badge>
            )}
            {vehicle.condition === "Certified Pre-Owned" && (
              <Badge variant="verified">Verified</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleSave(vehicle)}
            className={cn(
              "absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/95 shadow-luxury transition-colors duration-200 hover:bg-white",
              saved ? "text-brand-purple" : "text-brand-black hover:text-brand-purple"
            )}
            aria-label={saved ? "Remove from saved" : "Save vehicle"}
          >
            <Heart className={cn("size-4", saved && "fill-current")} />
          </button>
          <div className="absolute inset-x-0 bottom-0 translate-y-full bg-brand-charcoal/95 px-4 py-3 transition-transform duration-300 ease-out group-hover:translate-y-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-secondary">
                {vehicle.transmission} · {vehicle.engineSize}
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="text-white hover:bg-white/10 hover:text-brand-gold"
                onClick={() => setQuickViewOpen(true)}
              >
                <Eye className="size-3 text-brand-purple" />
                Quick View
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <Link href={`/inventory/${vehicle.slug}`} className="group/link">
            <h3 className="text-[15px] font-semibold text-foreground transition-colors duration-200 group-hover/link:text-brand-purple">
              {formatVehicleName(vehicle)}
            </h3>
          </Link>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-lg font-semibold text-brand-black">
              {formatPrice(vehicle.price)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Gauge className="size-3 shrink-0 text-brand-purple" />
              {formatMileage(vehicle.mileage)}
            </span>
            <span className="flex items-center gap-1.5">
              <Fuel className="size-3 shrink-0 text-brand-purple" />
              {vehicle.fuelType}
            </span>
            <span className="col-span-2 flex items-center gap-1.5">
              <MapPin className="size-3 shrink-0 text-brand-gold" />
              {vehicle.location}
            </span>
          </div>
        </div>
      </article>

      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formatVehicleName(vehicle)}</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
            <SafeVehicleImage
              src={photo}
              alt={formatVehicleName(vehicle)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Price</span>
              <p className="font-semibold">{formatPrice(vehicle.price)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Mileage</span>
              <p className="font-semibold">{formatMileage(vehicle.mileage)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fuel</span>
              <p className="font-semibold">{vehicle.fuelType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Location</span>
              <p className="font-semibold">{vehicle.location}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {vehicle.description}
          </p>
          <Button render={<Link href={`/inventory/${vehicle.slug}`} />}>
            View Full Details
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
