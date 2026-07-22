import { PLACEHOLDER_IMAGE } from "@/lib/data/vehicle-images";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import { SafeVehicleImageClient } from "@/components/shared/safe-vehicle-image-client";

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

  return (
    <SafeVehicleImageClient
      src={resolved}
      alt={alt}
      fill={fill}
      className={className}
      priority={priority}
      width={width}
      height={height}
      sizes={sizes}
    />
  );
}
