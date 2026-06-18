"use client";

import { useState } from "react";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { cn } from "@/lib/utils";

interface VehicleGalleryProps {
  images: string[];
  alt: string;
}

export function VehicleGallery({ images, alt }: VehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const displayImages = images.length > 0 ? images : ["/vehicles/placeholder.svg"];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <SafeVehicleImage
          src={displayImages[activeIndex]}
          alt={alt}
          priority
        />
      </div>
      {displayImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {displayImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative aspect-[4/3] overflow-hidden border-2 transition-colors",
                activeIndex === index
                  ? "border-brand-purple"
                  : "border-transparent hover:border-border"
              )}
            >
              <SafeVehicleImage
                src={image}
                alt={`${alt} view ${index + 1}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
