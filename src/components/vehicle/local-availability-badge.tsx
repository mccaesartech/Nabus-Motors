import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LocalAvailabilityBadgeProps = {
  available?: boolean | null;
  className?: string;
};

export function LocalAvailabilityBadge({
  available,
  className,
}: LocalAvailabilityBadgeProps) {
  if (!available) return null;

  return (
    <Badge variant="verified" className={cn(className)}>
      Now Available in Ghana
    </Badge>
  );
}
