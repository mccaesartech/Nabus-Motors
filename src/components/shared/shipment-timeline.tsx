import { shipmentStatusLabel } from "@/lib/platform/shipment";
import { cn } from "@/lib/utils";

export type ShipmentTimelineEvent = {
  title: string;
  description?: string | null;
  location?: string | null;
  event_at: string;
};

type ShipmentTimelineProps = {
  events: ShipmentTimelineEvent[];
  status?: string;
  className?: string;
  variant?: "public" | "account";
};

export function ShipmentTimeline({
  events,
  status,
  className,
  variant = "public",
}: ShipmentTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime()
  );

  return (
    <div className={cn("space-y-4", className)}>
      {status && (
        <p className="text-sm text-muted-foreground">
          Current status:{" "}
          <span className="font-medium text-foreground">{shipmentStatusLabel(status)}</span>
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timeline updates yet.</p>
      ) : (
        <ol className="space-y-4">
          {sorted.map((event, i) => (
            <li key={`${event.event_at}-${i}`} className="flex gap-3">
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  variant === "public" ? "bg-brand-cta-gold" : "bg-[var(--platform-accent)]"
                )}
              />
              <div>
                <p className="text-sm font-medium">{event.title}</p>
                {event.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(event.event_at).toLocaleString()}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
