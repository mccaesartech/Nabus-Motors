import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Trimmed full wordmark assets (logo.png, logo-purple.png). */
const FULL_LOGO_WIDTH = 1024;
const FULL_LOGO_HEIGHT = 374;
const FULL_LOGO_ASPECT = FULL_LOGO_WIDTH / FULL_LOGO_HEIGHT;

/** Visible height for corporate/freight wordmarks (excludes AUTO subtitle). */
const CORPORATE_CROP_HEIGHT = 308;
const CORPORATE_LOGO_ASPECT = FULL_LOGO_WIDTH / CORPORATE_CROP_HEIGHT;

export type LogoBrand = "corporate" | "auto" | "freight";

const DEFAULT_ALT: Record<LogoBrand, string> = {
  corporate: "True Goshen Company Limited",
  auto: "True Goshen Auto",
  freight: "True Goshen Freight",
};

function usesCorporateCrop(brand: LogoBrand) {
  return brand === "corporate" || brand === "freight";
}

function wordmarkAspect(brand: LogoBrand) {
  return usesCorporateCrop(brand) ? CORPORATE_LOGO_ASPECT : FULL_LOGO_ASPECT;
}

interface LogoProps {
  className?: string;
  /** White for dark public surfaces; purple for admin / light backgrounds */
  variant?: "white" | "purple";
  /** Corporate omits division subtitle; auto keeps AUTO line */
  brand?: LogoBrand;
  /** TG monogram only */
  icon?: boolean;
  /** Display height in pixels */
  height?: number;
  /** Max width in pixels (full logo only); height scales down to preserve aspect ratio */
  maxWidth?: number;
  href?: string | false;
  priority?: boolean;
  quality?: number;
  /** CMS override for full logo image */
  srcOverride?: string;
  /** CMS override for icon-only image */
  iconSrcOverride?: string;
  alt?: string;
}

function fullLogoWidth(
  height: number,
  maxWidth: number | undefined,
  brand: LogoBrand
) {
  const aspect = wordmarkAspect(brand);
  const naturalWidth = Math.round(height * aspect);
  if (!maxWidth || naturalWidth <= maxWidth) {
    return { width: naturalWidth, height };
  }
  return {
    width: maxWidth,
    height: Math.round(maxWidth / aspect),
  };
}

function CroppedWordmarkImage({
  src,
  alt,
  frameWidth,
  frameHeight,
  imageClassName,
  priority,
  quality,
}: {
  src: string;
  alt: string;
  frameWidth: number;
  frameHeight: number;
  imageClassName?: string;
  priority?: boolean;
  quality?: number;
}) {
  const imageHeight = Math.round(frameWidth * (FULL_LOGO_HEIGHT / FULL_LOGO_WIDTH));

  return (
    <span
      className="relative inline-flex shrink-0 overflow-hidden"
      style={{ width: frameWidth, height: frameHeight }}
    >
      <Image
        src={src}
        alt={alt}
        width={frameWidth}
        height={imageHeight}
        sizes={`${frameWidth}px`}
        priority={priority}
        quality={quality}
        className={cn(
          "absolute left-0 top-0 max-w-none object-cover object-left-top",
          imageClassName
        )}
        style={{ width: frameWidth, height: imageHeight }}
      />
    </span>
  );
}

export function Logo({
  className,
  variant = "white",
  brand = "auto",
  icon = false,
  height = 48,
  maxWidth,
  href = "/",
  priority = false,
  quality,
  srcOverride,
  iconSrcOverride,
  alt,
}: LogoProps) {
  const resolvedAlt = alt ?? DEFAULT_ALT[brand];

  const src = (() => {
    if (icon && iconSrcOverride) return iconSrcOverride;
    if (!icon && srcOverride) return srcOverride;
    if (variant === "purple") {
      return icon ? "/logo-icon-purple.png" : "/logo-purple.png";
    }
    return icon ? "/logo-icon.png" : "/logo.png";
  })();

  const dimensions = icon
    ? { width: height, height }
    : fullLogoWidth(height, maxWidth, brand);

  const imageClassName = cn(
    "object-contain object-left",
    variant === "white" && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
  );

  const image =
    !icon && usesCorporateCrop(brand) && !srcOverride ? (
      <CroppedWordmarkImage
        src={src}
        alt={resolvedAlt}
        frameWidth={dimensions.width}
        frameHeight={dimensions.height}
        imageClassName={imageClassName}
        priority={priority}
        quality={quality}
      />
    ) : (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-visible",
          className
        )}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          minWidth: icon ? dimensions.width : undefined,
        }}
      >
        <Image
          src={src}
          alt={resolvedAlt}
          fill
          sizes={`${dimensions.width}px`}
          priority={priority}
          quality={quality}
          className={imageClassName}
        />
      </span>
    );

  if (href === false) {
    return image;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center justify-center"
      aria-label={`${resolvedAlt} home`}
    >
      {image}
    </Link>
  );
}

/** Full wordmark sized from CSS height + aspect ratio (for responsive headers). */
export function LogoWordmark({
  className,
  variant = "white",
  brand = "auto",
  href = "/",
  priority = false,
  quality,
  srcOverride,
  alt,
}: Omit<LogoProps, "icon" | "height" | "maxWidth" | "iconSrcOverride">) {
  const resolvedAlt = alt ?? DEFAULT_ALT[brand];

  const src =
    srcOverride ||
    (variant === "purple" ? "/logo-purple.png" : "/logo.png");

  const imageClassName = cn(
    "object-contain object-left",
    variant === "white" && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
  );

  const crop = usesCorporateCrop(brand) && !srcOverride;

  const image = crop ? (
    <span
      className={cn(
        "inline-flex h-9 shrink-0 overflow-hidden sm:h-[var(--header-logo-size)]",
        className
      )}
      style={{ aspectRatio: `${FULL_LOGO_WIDTH} / ${CORPORATE_CROP_HEIGHT}` }}
    >
      <Image
        src={src}
        alt={resolvedAlt}
        width={FULL_LOGO_WIDTH}
        height={FULL_LOGO_HEIGHT}
        sizes="(max-width: 639px) 120px, (max-width: 1023px) 140px, 180px"
        priority={priority}
        quality={quality}
        className={cn(
          "h-[calc(100%*374/308)] w-full max-w-none object-cover object-left-top",
          imageClassName
        )}
      />
    </span>
  ) : (
    <Image
      src={src}
      alt={resolvedAlt}
      width={FULL_LOGO_WIDTH}
      height={FULL_LOGO_HEIGHT}
      sizes="(max-width: 639px) 120px, (max-width: 1023px) 140px, 180px"
      priority={priority}
      quality={quality}
      className={cn(
        "h-9 w-auto shrink-0 object-contain object-left sm:h-[var(--header-logo-size)]",
        imageClassName,
        className
      )}
    />
  );

  if (href === false) {
    return image;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center justify-center"
      aria-label={`${resolvedAlt} home`}
    >
      {image}
    </Link>
  );
}
