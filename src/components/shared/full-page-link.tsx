import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type FullPageLinkProps = ComponentProps<"a"> & {
  href: string;
};

/** Full document navigation — avoids fragile App Router soft-nav chunk failures. */
export function FullPageLink({
  href,
  className,
  children,
  ...props
}: FullPageLinkProps) {
  return (
    <a href={href} className={cn(className)} {...props}>
      {children}
    </a>
  );
}
