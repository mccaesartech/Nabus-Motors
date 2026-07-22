import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type FullPageLinkProps = ComponentProps<"a"> & {
  href: string;
};

/**
 * Primary-nav link. Historically forced full document navigations to dodge
 * stale-chunk failures after deploys; ChunkReloadHandler + the cache-recovery
 * inline script now auto-reload on chunk errors, so client-side navigation
 * (with prefetching) is safe and much faster.
 */
export function FullPageLink({
  href,
  className,
  children,
  ...props
}: FullPageLinkProps) {
  return (
    <Link href={href} className={cn(className)} {...props}>
      {children}
    </Link>
  );
}
