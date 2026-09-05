import type { NabusTimelineStep } from "@/components/nabus/nabus-timeline";
import { SHIPMENT_VISUAL_STEPS, shipmentStatusStepIndex } from "@/lib/platform/shipment";

const CUSTOMER_TRACKING_STEPS = [
  { status: "pending", title: "Request Received" },
  { status: "booked", title: "Booked" },
  { status: "in_transit", title: "In Transit" },
  { status: "at_port", title: "At Port" },
  { status: "clearing", title: "Clearing" },
  { status: "delivered", title: "Delivered" },
] as const;

export function buildShipmentTimelineSteps(status: string): NabusTimelineStep[] {
  const currentIndex = shipmentStatusStepIndex(status);
  const cancelled = status === "cancelled";

  return CUSTOMER_TRACKING_STEPS.map((step, index) => {
    if (cancelled) {
      return {
        title: step.title,
        status: "upcoming" as const,
      };
    }
    if (index < currentIndex) {
      return { title: step.title, status: "complete" as const };
    }
    if (index === currentIndex) {
      return {
        title: step.title,
        description: SHIPMENT_VISUAL_STEPS[index]?.label,
        status: "current" as const,
      };
    }
    return { title: step.title, status: "upcoming" as const };
  });
}
