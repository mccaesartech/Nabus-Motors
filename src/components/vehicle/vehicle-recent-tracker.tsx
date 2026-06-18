"use client";

import { useEffect } from "react";
import { useGarage } from "@/hooks/use-garage";

export function VehicleRecentTracker({ vehicleId }: { vehicleId: string }) {
  const { addRecent } = useGarage();

  useEffect(() => {
    addRecent(vehicleId);
  }, [vehicleId, addRecent]);

  return null;
}
