import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LocalAvailabilityBadgeProps = {
  available?: boolean | null;
  className?: string;
  /** Shorter label for inventory cards. */
  compact?: boolean;
};

export function LocalAvailabilityBadge({
  available,
  className,
  compact = false,
}: LocalAvailabilityBadgeProps) {
  if (!available) return null;

  return (
    <Badge variant="verified" className={cn(className)}>
      {compact ? "In Ghana" : "Now Available in Ghana"}
    </Badge>
  );
}
