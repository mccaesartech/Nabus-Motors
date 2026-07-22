"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type BackNavVariant = "public" | "platform";

export type BackNavProps = {
  /** Explicit destination — renders a prefetched link (preferred for labeled back). */
  href?: string;
  label?: string;
  /** Used when history back is unavailable, or as Link target when preferFallback. */
  fallbackHref?: string;
  /**
   * When true (default), navigate via Link to fallbackHref instead of history.back().
   * Labeled backs ("Back to inventory") stay predictable and soft-nav fast.
   * Set false only when true browser-history back is required.
   */
  preferFallback?: boolean;
  variant?: BackNavVariant;
  className?: string;
  /** Compact layout for topbars and tight headers. */
  compact?: boolean;
};

const variantClass: Record<BackNavVariant, string> = {
  public: "site-back-nav",
  platform: "platform-back-nav",
};

/** Same-origin referrer or short history — history.length alone is unreliable. */
function canUseHistoryBack(): boolean {
  if (typeof window === "undefined") return false;
  if (window.history.length <= 1) return false;
  try {
    const referrer = document.referrer;
    if (!referrer) return false;
    return new URL(referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function BackNav({
  href,
  label = "Back",
  fallbackHref = "/",
  preferFallback = true,
  variant = "public",
  className,
  compact = false,
}: BackNavProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const linkHref = href ?? (preferFallback ? fallbackHref : undefined);

  const classes = cn(
    variantClass[variant],
    compact && "back-nav-compact",
    pending && "back-nav-pending",
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

  const onHistoryBack = useCallback(() => {
    setPending(true);
    startTransition(() => {
      if (canUseHistoryBack()) {
        router.back();
      } else {
        router.push(fallbackHref);
      }
    });
  }, [fallbackHref, router]);

  if (linkHref) {
    return (
      <Link
        href={linkHref}
        prefetch
        className={classes}
        onClick={() => setPending(true)}
        aria-busy={pending || undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onHistoryBack}
      className={classes}
      aria-busy={pending || undefined}
      disabled={pending}
    >
      {content}
    </button>
  );
}

/** Alias for customer-facing pages — same as BackNav. */
export const PageBackNav = BackNav;
