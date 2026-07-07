"use client";

import { useMemo, useState } from "react";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import {
  PLACEHOLDER_IMAGE,
  primaryPhotoFor,
  resolveAdditionalImages,
  resolvePrimaryImageUrl,
} from "@/lib/data/vehicle-images";
import type { BodyType, VehicleGalleryData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VehicleGalleryProps {
  primaryImageUrl?: string;
  additionalImages?: string[];
  gallery?: VehicleGalleryData;
  images?: string[];
  alt: string;
  slug?: string;
  id?: string;
  bodyType?: BodyType;
}

export function VehicleGallery({
  primaryImageUrl,
  additionalImages,
  gallery,
  images,
  alt,
  slug = "",
  id = "",
  bodyType = "SUV",
}: VehicleGalleryProps) {
  const heroImage = useMemo(() => {
    const resolved = resolvePrimaryImageUrl({
      primaryImageUrl,
      gallery,
      images,
    });
    if (resolved) return resolved;
    if (slug || id) {
      return primaryPhotoFor({ slug, id, bodyType, gallery, images });
    }
    return PLACEHOLDER_IMAGE;
  }, [primaryImageUrl, additionalImages, gallery, images, slug, id, bodyType]);

  const extraImages = useMemo(
    () =>
      resolveAdditionalImages({
        primaryImageUrl,
        additionalImages,
        gallery,
        images,
      }),
    [primaryImageUrl, additionalImages, gallery, images]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const carouselImages = useMemo(() => {
    if (extraImages.length === 0) return [heroImage];
    return [heroImage, ...extraImages];
  }, [heroImage, extraImages]);

  const activeImage = carouselImages[activeIndex] ?? heroImage;

  function selectImage(index: number) {
    setActiveIndex(index);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <SafeVehicleImage src={activeImage} alt={alt} priority />
        {activeIndex > 0 && (
          <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            Photo {activeIndex + 1} of {carouselImages.length}
          </div>
        )}
      </div>

      {carouselImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {carouselImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => selectImage(index)}
              className={cn(
                "relative aspect-[4/3] overflow-hidden border-2 transition-colors",
                activeIndex === index
                  ? "border-foreground"
                  : "border-transparent hover:border-border"
              )}
            >
              <SafeVehicleImage
                src={image}
                alt={index === 0 ? `${alt} — primary` : `${alt} — photo ${index + 1}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
