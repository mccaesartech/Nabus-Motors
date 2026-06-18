"use client";

import { useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/lib/data/vehicle-images";
import { cn } from "@/lib/utils";

interface SafeVehicleImageProps {
  src?: string;
  alt: string;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

export function SafeVehicleImage({
  src,
  alt,
  fill = true,
  className,
  priority,
  width,
  height,
}: SafeVehicleImageProps) {
  const initial = src?.trim() || PLACEHOLDER_IMAGE;
  const [imgSrc, setImgSrc] = useState(initial);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (!failed && imgSrc !== PLACEHOLDER_IMAGE) {
      setFailed(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  if (!fill && width && height) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("object-cover", className)}
        onError={handleError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn(
        fill && "absolute inset-0 h-full w-full",
        "object-cover",
        className
      )}
      onError={handleError}
    />
  );
}
