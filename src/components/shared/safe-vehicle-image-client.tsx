"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/lib/data/vehicle-images";
import { isSupabaseStoragePublicUrl } from "@/lib/site-content/media-url";
import { cn } from "@/lib/utils";

const DEFAULT_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw";

interface SafeVehicleImageClientProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
}

/**
 * Renders a vehicle photo. Keeps the muted parent background while loading;
 * only swaps to the grey car silhouette after a confirmed load failure —
 * avoids grey→photo→grey flicker when the URL is valid.
 */
export function SafeVehicleImageClient({
  src,
  alt,
  fill = true,
  className,
  priority,
  width,
  height,
  sizes,
}: SafeVehicleImageClientProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailedSrc(null);
    setLoadedSrc(null);
  }, [src]);

  const isPlaceholder = src === PLACEHOLDER_IMAGE;
  const failed = failedSrc === src;
  const imgSrc = failed ? PLACEHOLDER_IMAGE : src;
  const showImage = isPlaceholder || failed || loadedSrc === imgSrc;
  // Uploaded listing photos are already resized/compressed in storage — skip the
  // Next.js optimizer hop so the first public paint hits Supabase CDN directly.
  const unoptimized = !isPlaceholder && isSupabaseStoragePublicUrl(imgSrc);

  const handleError = () => {
    if (imgSrc !== PLACEHOLDER_IMAGE) {
      setFailedSrc(src);
      setLoadedSrc(PLACEHOLDER_IMAGE);
    }
  };

  const handleLoad = () => {
    setLoadedSrc(imgSrc);
  };

  // Cached images often finish before onLoad is attached; also catch stuck loads.
  useEffect(() => {
    if (showImage) return;

    const syncFromDom = () => {
      const img = imgRef.current;
      if (!img) return;
      if (img.complete) {
        if (img.naturalWidth > 0) {
          setLoadedSrc(imgSrc);
        } else if (imgSrc !== PLACEHOLDER_IMAGE) {
          setFailedSrc(src);
          setLoadedSrc(PLACEHOLDER_IMAGE);
        }
      }
    };

    syncFromDom();
    const raf = window.requestAnimationFrame(syncFromDom);
    const timer = window.setTimeout(() => {
      // Last resort: reveal whatever the optimizer served so admin previews
      // never stay permanently invisible when onLoad is skipped.
      setLoadedSrc((prev) => prev ?? imgSrc);
    }, 2000);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [showImage, imgSrc, src]);

  const imageClassName = cn(
    "object-cover transition-opacity duration-300",
    showImage ? "opacity-100" : "opacity-0",
    className
  );

  if (!fill && width && height) {
    return (
      <Image
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes ?? `${width}px`}
        preload={priority}
        loading={priority ? undefined : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        unoptimized={unoptimized}
        className={imageClassName}
        onError={handleError}
        onLoad={handleLoad}
      />
    );
  }

  return (
    <Image
      ref={imgRef}
      src={imgSrc}
      alt={alt}
      fill
      sizes={sizes ?? DEFAULT_SIZES}
      preload={priority}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      unoptimized={unoptimized}
      className={imageClassName}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}
