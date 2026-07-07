"use client";

import type { Vehicle } from "@/lib/types";
import { SiteVideoEmbed } from "@/components/shared/site-video";
import { trackVehicleInterest } from "@/lib/vehicle-interest/client";

type VehicleWalkaroundVideoProps = {
  vehicle: Vehicle;
};

export function VehicleWalkaroundVideo({ vehicle }: VehicleWalkaroundVideoProps) {
  const url = vehicle.walkaroundVideoUrl?.trim();
  if (!url) return null;

  function handleVideoEngagement() {
    trackVehicleInterest("video_watch", vehicle);
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold">Walkaround Video</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Take a closer look at this {vehicle.year} {vehicle.make} {vehicle.model}.
      </p>
      <div className="mt-4" onClick={handleVideoEngagement} onKeyDown={undefined} role="presentation">
        <SiteVideoEmbed
          url={url}
          title={`${vehicle.year} ${vehicle.make} ${vehicle.model} walkaround`}
          display={{ videoAspect: "16:9", videoSize: "full", videoObjectFit: "cover" }}
        />
      </div>
    </div>
  );
}
