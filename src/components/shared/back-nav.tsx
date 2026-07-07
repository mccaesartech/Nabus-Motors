"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type BackNavVariant = "public" | "platform";

export type BackNavProps = {
  /** Explicit destination — renders a link instead of history back. */
  href?: string;
  label?: string;
  /** Used when history back is unavailable. */
  fallbackHref?: string;
  variant?: BackNavVariant;
  className?: string;
  /** Compact layout for topbars and tight headers. */
  compact?: boolean;
};

const variantClass: Record<BackNavVariant, string> = {
  public: "site-back-nav",
  platform: "platform-back-nav",
};

export function BackNav({
  href,
  label = "Back",
  fallbackHref = "/",
  variant = "public",
  className,
  compact = false,
}: BackNavProps) {
  const router = useRouter();

  const classes = cn(
    variantClass[variant],
    compact && "back-nav-compact",
    className
  );

  const content = (
    <>
      <span className="back-nav-icon" aria-hidden>
        <ArrowLeft className="size-4" strokeWidth={2.25} />
      </span>
      <span className="back-nav-label">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={classes}
    >
      {content}
    </button>
  );
}

/** Alias for customer-facing pages — same as BackNav. */
export const PageBackNav = BackNav;
