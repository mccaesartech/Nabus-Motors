import { BadgeCheck, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  activeTrustBadges,
  TRUST_BADGE_LABELS,
  type VehicleTrustBadges,
} from "@/lib/vehicles/trust-badges";
import { cn } from "@/lib/utils";

type VehicleTrustBadgesProps = {
  badges: VehicleTrustBadges;
  variant?: "card" | "detail" | "inline";
  className?: string;
};

export function VehicleTrustBadges({
  badges,
  variant = "inline",
  className,
}: VehicleTrustBadgesProps) {
  const active = activeTrustBadges(badges);
  if (active.length === 0) return null;

  if (variant === "card") {
    const primary = active[0];
    const extra = active.length - 1;
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <Badge variant="verified" className="gap-1">
          <BadgeCheck className="size-3" />
          {TRUST_BADGE_LABELS[primary]}
        </Badge>
        {extra > 0 && (
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
            +{extra} more
          </span>
        )}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
        {active.map((key) => (
          <li
            key={key}
            className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-brand-purple" strokeWidth={2.5} />
            <span className="font-medium text-foreground">{TRUST_BADGE_LABELS[key]}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {active.map((key) => (
        <Badge key={key} variant="verified" className="gap-1">
          <Check className="size-3" />
          {TRUST_BADGE_LABELS[key]}
        </Badge>
      ))}
    </div>
  );
}
