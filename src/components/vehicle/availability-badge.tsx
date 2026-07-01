import { Badge } from "@/components/ui/badge";
import { availabilityLabel } from "@/lib/vehicles/availability";
import { cn } from "@/lib/utils";

type AvailabilityBadgeProps = {
  status?: string | null;
  className?: string;
};

export function AvailabilityBadge({ status, className }: AvailabilityBadgeProps) {
  const label = availabilityLabel(status);

  const variant =
    status === "pre_order"
      ? "featured"
      : status === "sold"
        ? "outline"
        : status === "reserved"
          ? "secondary"
          : "verified";

  if (status === "available" || !status) {
    return (
      <Badge variant="verified" className={className}>
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  );
}
