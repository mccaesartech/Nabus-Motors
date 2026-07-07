import { FileCheck } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { resolveWarrantyNotes } from "@/lib/vehicles/warranty";

type VehicleWarrantyInfoProps = {
  vehicle: Vehicle;
};

export function VehicleWarrantyInfo({ vehicle }: VehicleWarrantyInfoProps) {
  const notes = resolveWarrantyNotes(vehicle);

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2">
        <FileCheck className="size-5 text-brand-purple" />
        <h2 className="text-lg font-semibold">Warranty Information</h2>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{notes}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Coverage varies by vehicle age, origin, and condition. Our team will confirm applicable
        warranty terms before you complete your purchase.
      </p>
    </div>
  );
}
