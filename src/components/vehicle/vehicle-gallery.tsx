"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import {
  gallerySectionsFor,
  PLACEHOLDER_IMAGE,
  sectionForImageIndex,
} from "@/lib/data/vehicle-images";
import type { VehicleGalleryData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VehicleGalleryProps {
  gallery?: VehicleGalleryData;
  images?: string[];
  alt: string;
}

export function VehicleGallery({ gallery, images, alt }: VehicleGalleryProps) {
  const sections = useMemo(
    () => gallerySectionsFor({ gallery, images }),
    [gallery, images]
  );
  const flatImages = useMemo(
    () => sections.flatMap((section) => section.images),
    [sections]
  );
  const displayImages = flatImages.length > 0 ? flatImages : [PLACEHOLDER_IMAGE];
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const sectionsWithOffset = useMemo(() => {
    let offset = 0;
    return sections.map((section) => {
      const startIndex = offset;
      offset += section.images.length;
      return { ...section, startIndex };
    });
  }, [sections]);
  const activeSection = sectionForImageIndex(sections, activeIndex);

  function selectImage(globalIndex: number) {
    setActiveIndex(globalIndex);
  }

  const showExpand = sections.length > 1 || displayImages.length > 5;

  function renderThumbnail(image: string, globalIndex: number) {
    return (
      <button
        key={`${image}-${globalIndex}`}
        type="button"
        onClick={() => selectImage(globalIndex)}
        className={cn(
          "relative aspect-[4/3] overflow-hidden border-2 transition-colors",
          activeIndex === globalIndex
            ? "border-foreground"
            : "border-transparent hover:border-border"
        )}
      >
        <SafeVehicleImage src={image} alt={`${alt} view ${globalIndex + 1}`} />
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <SafeVehicleImage
          src={displayImages[activeIndex] ?? displayImages[0]}
          alt={alt}
          priority
        />
        {activeSection && sections.length > 1 && (
          <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            {activeSection.label}
          </div>
        )}
      </div>

      {displayImages.length > 1 && (
        <div className="space-y-3">
          {sectionsWithOffset.map((section) => {
            if (section.images.length === 0) return null;

            return (
              <div key={section.key} className="space-y-2">
                {sections.length > 1 && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {section.images.map((image, index) =>
                    renderThumbnail(image, section.startIndex + index)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showExpand && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
        >
          {expanded ? (
            <>
              Show fewer photos
              <ChevronUp className="size-4" />
            </>
          ) : (
            <>
              See all photos by category
              <ChevronDown className="size-4" />
            </>
          )}
        </button>
      )}

      {expanded && sections.length > 0 && (
        <div className="space-y-8 border-t border-border pt-6">
          {sections.map((section) => (
            <section key={section.key}>
              <h3 className="text-base font-semibold">{section.label}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {section.images.map((image, index) => {
                  const globalIndex = flatImages.indexOf(image);
                  return (
                    <button
                      key={`${section.key}-${image}-${index}`}
                      type="button"
                      onClick={() => {
                        selectImage(globalIndex >= 0 ? globalIndex : 0);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={cn(
                        "relative aspect-[16/10] overflow-hidden bg-muted",
                        activeIndex === globalIndex && "ring-2 ring-foreground"
                      )}
                    >
                      <SafeVehicleImage
                        src={image}
                        alt={`${alt} — ${section.label} ${index + 1}`}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
