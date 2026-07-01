import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CustomVehicleRequestCtaProps = {
  className?: string;
  variant?: "card" | "inline" | "banner";
};

export function CustomVehicleRequestCta({
  className,
  variant = "card",
}: CustomVehicleRequestCtaProps) {
  if (variant === "inline") {
    return (
      <Link
        href={ROUTES.auto.customRequest}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline",
          className
        )}
      >
        <Search className="size-4" />
        Can&apos;t find your car? Request it
        <ArrowRight className="size-3.5" />
      </Link>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-brand-purple/25 bg-gradient-to-r from-brand-purple/10 via-brand-gold/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand-gold/40 bg-brand-gold/15">
            <Search className="size-5 text-brand-purple" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Can&apos;t find your car?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tell us the make, model, and budget — our team will follow up if we can source it.
            </p>
          </div>
        </div>
        <Link
          href={ROUTES.auto.customRequest}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark"
        >
          Request a vehicle not listed
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-brand-purple/30 bg-brand-purple/5 p-4 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-foreground">Request a vehicle not listed</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Describe the car you want and we&apos;ll let you know if we can get it.
      </p>
      <Link
        href={ROUTES.auto.customRequest}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline"
      >
        Start custom request
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
