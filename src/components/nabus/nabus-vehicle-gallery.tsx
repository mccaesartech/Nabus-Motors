"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { cn } from "@/lib/utils";

type NabusVehicleGalleryProps = {
  images: string[];
  alt: string;
  className?: string;
};

export function NabusVehicleGallery({ images, alt, className }: NabusVehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const photos = images.length > 0 ? images : [""];

  const go = (dir: "prev" | "next") => {
    setActiveIndex((i) => {
      if (dir === "prev") return i <= 0 ? photos.length - 1 : i - 1;
      return i >= photos.length - 1 ? 0 : i + 1;
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-background)]">
        <div className="relative aspect-[4/3]">
          <SafeVehicleImage
            src={photos[activeIndex]}
            alt={alt}
            priority
            sizes="(max-width: 1024px) 100vw, 65vw"
            className="object-cover"
          />
        </div>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go("prev")}
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg border border-[var(--nabus-border)] bg-[var(--nabus-surface)]/95 text-[var(--nabus-charcoal)] shadow-sm transition-colors hover:bg-[var(--nabus-surface)]"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go("next")}
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg border border-[var(--nabus-border)] bg-[var(--nabus-surface)]/95 text-[var(--nabus-charcoal)] shadow-sm transition-colors hover:bg-[var(--nabus-surface)]"
              aria-label="Next image"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-[var(--nabus-charcoal)]/70 px-2 py-1 text-xs font-medium text-white">
              <Expand className="size-3" />
              {activeIndex + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === activeIndex
                  ? "border-[var(--nabus-primary)]"
                  : "border-[var(--nabus-border)] hover:border-[var(--nabus-primary)]/40"
              )}
              aria-label={`View image ${i + 1}`}
            >
              <SafeVehicleImage src={src} alt="" className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
