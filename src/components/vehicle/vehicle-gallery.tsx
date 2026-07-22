"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import {
  PLACEHOLDER_IMAGE,
  flattenGallery,
  galleryHasImages,
  primaryPhotoFor,
  resolveAdditionalImages,
  resolvePrimaryImageUrl,
  resolveVehicleGallery,
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

const SWIPE_THRESHOLD_PX = 48;

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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const carouselImages = useMemo(() => {
    const resolvedGallery = resolveVehicleGallery({ gallery, images });
    if (galleryHasImages(resolvedGallery)) {
      const flat = flattenGallery(resolvedGallery);
      if (flat.length > 0) {
        if (flat.includes(heroImage)) {
          return [heroImage, ...flat.filter((url) => url !== heroImage)];
        }
        return flat;
      }
    }
    if (extraImages.length === 0) return [heroImage];
    return [heroImage, ...extraImages];
  }, [heroImage, extraImages, gallery, images]);

  const count = carouselImages.length;
  const canNavigate = count > 1;
  const activeImage = carouselImages[activeIndex] ?? heroImage;

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      const next = ((index % count) + count) % count;
      setActiveIndex(next);
    },
    [count]
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  function selectImage(index: number) {
    setActiveIndex(index);
  }

  function openLightbox() {
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <button
          type="button"
          onClick={openLightbox}
          className="absolute inset-0 z-[1] cursor-zoom-in touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-label={`View ${alt} fullscreen — photo ${activeIndex + 1} of ${count}`}
        >
          <SafeVehicleImage
            src={activeImage}
            alt={alt}
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
        </button>

        {canNavigate && (
          <>
            <NavArrow
              direction="prev"
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-[2] -translate-y-1/2"
              label="Previous photo"
            />
            <NavArrow
              direction="next"
              onClick={goNext}
              className="absolute right-2 top-1/2 z-[2] -translate-y-1/2"
              label="Next photo"
            />
          </>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 z-[2] flex items-center gap-2">
          <span className="rounded bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            Photo {activeIndex + 1} of {count}
          </span>
          <span className="hidden items-center gap-1 rounded bg-black/60 px-2.5 py-1 text-xs font-medium text-white sm:inline-flex">
            <Expand className="size-3.5" aria-hidden />
            Tap to enlarge
          </span>
        </div>
      </div>

      {canNavigate && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {carouselImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => selectImage(index)}
              className={cn(
                "relative aspect-[4/3] min-h-11 cursor-pointer overflow-hidden border-2 transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeIndex === index
                  ? "border-foreground"
                  : "border-transparent hover:border-border"
              )}
              aria-label={`Show photo ${index + 1}`}
              aria-current={activeIndex === index ? "true" : undefined}
            >
              <SafeVehicleImage
                src={image}
                alt={
                  index === 0
                    ? `${alt} — primary`
                    : `${alt} — photo ${index + 1}`
                }
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <GalleryLightbox
          images={carouselImages}
          index={activeIndex}
          alt={alt}
          onClose={closeLightbox}
          onIndexChange={goTo}
        />
      )}
    </div>
  );
}

function NavArrow({
  direction,
  onClick,
  className,
  label,
  size = "md",
}: {
  direction: "prev" | "next";
  onClick: () => void;
  className?: string;
  label: string;
  size?: "md" | "lg";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-sm transition-[background-color,transform,opacity] duration-200 touch-manipulation hover:bg-black/75 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        size === "lg" ? "size-12" : "size-11",
        className
      )}
    >
      <Icon className={size === "lg" ? "size-6" : "size-5"} aria-hidden />
    </button>
  );
}

function GalleryLightbox({
  images,
  index,
  alt,
  onClose,
  onIndexChange,
}: {
  images: string[];
  index: number;
  alt: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const count = images.length;
  const canNavigate = count > 1;
  const activeImage = images[index] ?? images[0];
  const touchStartX = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  // Ignore the opening click so it cannot immediately dismiss the overlay.
  const [backdropArmed, setBackdropArmed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const armTimer = window.setTimeout(() => setBackdropArmed(true), 120);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(armTimer);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!canNavigate) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNavigate, index, onClose, onIndexChange]);

  function onTouchStart(event: TouchEvent) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    if (touchStartX.current == null || !canNavigate) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta > 0) onIndexChange(index - 1);
    else onIndexChange(index + 1);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} photo gallery`}
      className="fixed inset-0 z-[200] bg-black motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      onClick={() => {
        if (backdropArmed) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Edge-to-edge photo — fills the viewport */}
      <div className="absolute inset-0">
        <SafeVehicleImage
          src={activeImage}
          alt={`${alt} — photo ${index + 1} of ${count}`}
          className="object-cover"
          priority
          sizes="100vw"
        />
      </div>

      {/* Controls overlay — stays above the filled image */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 sm:px-4">
          <p className="truncate text-sm font-medium text-white drop-shadow-sm">
            {alt}
            <span className="ml-2 text-white/80">
              {index + 1} / {count}
            </span>
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close fullscreen gallery"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white text-black shadow-md transition-[transform,background-color] duration-200 touch-manipulation hover:bg-white/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {canNavigate && (
          <>
            <NavArrow
              direction="prev"
              onClick={() => onIndexChange(index - 1)}
              className="pointer-events-auto absolute left-2 top-1/2 z-[2] -translate-y-1/2 sm:left-4"
              label="Previous photo"
              size="lg"
            />
            <NavArrow
              direction="next"
              onClick={() => onIndexChange(index + 1)}
              className="pointer-events-auto absolute right-2 top-1/2 z-[2] -translate-y-1/2 sm:right-4"
              label="Next photo"
              size="lg"
            />
          </>
        )}
      </div>

      <p className="sr-only">
        Use arrow keys or swipe to change photos. Press Escape to close.
      </p>
    </div>,
    document.body
  );
}
