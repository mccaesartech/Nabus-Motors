"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/lib/data/vehicle-images";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import { cn } from "@/lib/utils";

const DEFAULT_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw";

interface SafeVehicleImageProps {
  src?: string;
  alt: string;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
}

export function SafeVehicleImage({
  src,
  alt,
  fill = true,
  className,
  priority,
  width,
  height,
  sizes,
}: SafeVehicleImageProps) {
  const resolved = normalizeMediaUrl(src ?? "") || PLACEHOLDER_IMAGE;
  const [imgSrc, setImgSrc] = useState(resolved);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgSrc(resolved);
    setFailed(false);
  }, [resolved]);

  const handleError = () => {
    if (!failed && imgSrc !== PLACEHOLDER_IMAGE) {
      setFailed(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  if (!fill && width && height) {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes ?? `${width}px`}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("object-cover", className)}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      sizes={sizes ?? DEFAULT_SIZES}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("object-cover", className)}
      onError={handleError}
    />
  );
}
