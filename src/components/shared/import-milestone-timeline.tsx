import { MilestoneAttachments } from "@/components/shared/milestone-attachments";
import { cn } from "@/lib/utils";

export type ImportMilestoneId =
  | "order_confirmed"
  | "vehicle_purchased"
  | "preparing_shipment"
  | "loaded_container"
  | "container_departed"
  | "at_sea"
  | "arrived_ghana"
  | "awaiting_customs"
  | "customs_cleared"
  | "ready_collection"
  | "delivered";

export type ImportMilestone = {
  id: ImportMilestoneId;
  label: string;
  eventTypes: string[];
};

/** Full vehicle import timeline from V2 spec — matched against shipment_timeline_events.event_type. */
export const VEHICLE_IMPORT_MILESTONES: ImportMilestone[] = [
  { id: "order_confirmed", label: "Order Confirmed", eventTypes: ["order_confirmed", "confirmed"] },
  { id: "vehicle_purchased", label: "Vehicle Purchased", eventTypes: ["vehicle_purchased", "payment_received"] },
  { id: "preparing_shipment", label: "Preparing Shipment", eventTypes: ["preparing_shipment", "booked"] },
  { id: "loaded_container", label: "Loaded into Container", eventTypes: ["loaded_container"] },
  { id: "container_departed", label: "Container Departed", eventTypes: ["container_departed"] },
  { id: "at_sea", label: "At Sea", eventTypes: ["at_sea", "in_transit"] },
  { id: "arrived_ghana", label: "Arrived in Ghana", eventTypes: ["arrived_port", "at_port"] },
  { id: "awaiting_customs", label: "Awaiting Customs Clearance", eventTypes: ["awaiting_customs", "clearing"] },
  { id: "customs_cleared", label: "Cleared", eventTypes: ["customs_cleared"] },
  { id: "ready_collection", label: "Ready for Collection", eventTypes: ["ready_pickup", "ready"] },
  { id: "delivered", label: "Delivered", eventTypes: ["delivered"] },
];

export type ImportMilestoneEvent = {
  event_type?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  event_at: string;
  estimated_completion?: string | null;
  admin_comment?: string | null;
  attachment_urls?: string[] | null;
};

export type ResolvedImportMilestone = ImportMilestone & {
  state: "completed" | "current" | "pending";
  event?: ImportMilestoneEvent;
};

function normalizeEventType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveImportMilestones(
  events: ImportMilestoneEvent[],
  shipmentStatus?: string
): ResolvedImportMilestone[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime()
  );

  const eventByType = new Map<string, ImportMilestoneEvent>();
  for (const event of sorted) {
    const type = normalizeEventType(event.event_type);
    if (type && !eventByType.has(type)) eventByType.set(type, event);
    const titleKey = event.title.trim().toLowerCase().replace(/\s+/g, "_");
    if (titleKey && !eventByType.has(titleKey)) eventByType.set(titleKey, event);
  }

  let lastCompletedIndex = -1;
  const resolved: ResolvedImportMilestone[] = VEHICLE_IMPORT_MILESTONES.map((milestone, index) => {
    const match = milestone.eventTypes
      .map((type) => eventByType.get(type))
      .find(Boolean);

    if (match) lastCompletedIndex = index;

    return {
      ...milestone,
      state: match ? "completed" : "pending",
      event: match,
    };
  });

  if (shipmentStatus === "delivered") {
    const deliveredIndex = resolved.findIndex((m) => m.id === "delivered");
    if (deliveredIndex >= 0) lastCompletedIndex = deliveredIndex;
  }

  if (lastCompletedIndex >= 0 && lastCompletedIndex < resolved.length - 1) {
    const next = resolved[lastCompletedIndex + 1];
    if (next.state === "pending") next.state = "current";
  } else if (lastCompletedIndex === -1 && resolved[0]) {
    resolved[0].state = "current";
  }

  return resolved;
}

type ImportMilestoneTimelineProps = {
  events: ImportMilestoneEvent[];
  shipmentStatus?: string;
  className?: string;
};

export function ImportMilestoneTimeline({
  events,
  shipmentStatus,
  className,
}: ImportMilestoneTimelineProps) {
  const milestones = resolveImportMilestones(events, shipmentStatus);

  return (
    <ol className={cn("space-y-0", className)}>
      {milestones.map((milestone, index) => {
        const isLast = index === milestones.length - 1;
        const note = milestone.event?.admin_comment || milestone.event?.description;

        return (
          <li key={milestone.id} className="flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-3 shrink-0 items-center justify-center rounded-full border-2",
                  milestone.state === "completed" &&
                    "border-brand-cta-gold bg-brand-cta-gold",
                  milestone.state === "current" &&
                    "border-brand-purple bg-brand-purple/20",
                  milestone.state === "pending" && "border-border bg-muted"
                )}
              />
              {!isLast && (
                <div
                  className={cn(
                    "mt-1 w-px flex-1",
                    milestone.state === "completed" ? "bg-brand-cta-gold/60" : "bg-border"
                  )}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  milestone.state === "pending" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {milestone.label}
              </p>
              {milestone.event && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(milestone.event.event_at).toLocaleString()}
                  {milestone.event.location ? ` · ${milestone.event.location}` : ""}
                </p>
              )}
              {milestone.event?.estimated_completion && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Est. completion:{" "}
                  {new Date(milestone.event.estimated_completion).toLocaleString()}
                </p>
              )}
              {note && (
                <p className="mt-1.5 text-sm text-muted-foreground">{note}</p>
              )}
              {milestone.event?.attachment_urls && milestone.event.attachment_urls.length > 0 && (
                <MilestoneAttachments urls={milestone.event.attachment_urls} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
