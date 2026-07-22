"use client";

import { BackNav } from "@/components/shared/back-nav";
import { platformPath } from "@/lib/platform/paths";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  compact?: boolean;
  className?: string;
};

export function BackButton({
  fallbackHref = platformPath("dashboard"),
  label = "Back",
  compact = false,
  className,
}: BackButtonProps) {
  return (
    <BackNav
      variant="platform"
      href={fallbackHref}
      label={label}
      fallbackHref={fallbackHref}
      compact={compact}
      className={className}
    />
  );
}
