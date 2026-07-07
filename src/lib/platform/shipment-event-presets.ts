import type { ShipmentStatus } from "@/lib/platform/shipment";

export type ShipmentEventPreset = {
  id: string;
  label: string;
  title: string;
  location: string;
  descriptionTemplate: string;
  suggestedStatus?: ShipmentStatus;
};

export type ShipmentPresetContext = {
  tracking_number?: string;
  customer_name?: string;
  origin_country?: string;
  destination?: string;
  container_number?: string;
  vessel_name?: string;
  estimated_arrival?: string;
};

export const SHIPMENT_STATUS_HINTS: Record<ShipmentStatus, string> = {
  pending: "Order received — progress bar at step 1",
  booked: "Space reserved on vessel; awaiting loading",
  in_transit: "Loaded and en route (sea or air)",
  at_port: "Arrived at destination port (e.g. Tema)",
  clearing: "Customs clearance in progress",
  delivered: "Handed over to customer — final step",
  cancelled: "Shipment cancelled — hidden from progress bar",
};

/** One-click milestone chips — adds timeline event + updates status together. */
export const QUICK_SHIPMENT_EVENT_PRESETS: ShipmentEventPreset[] = [
  {
    id: "confirmed",
    label: "Confirmed",
    title: "Order confirmed",
    location: "",
    descriptionTemplate:
      "Your shipment {tracking_number} has been confirmed. We will keep you updated as it moves through each stage.",
    suggestedStatus: "pending",
  },
  {
    id: "in_transit",
    label: "In transit",
    title: "In transit",
    location: "At sea",
    descriptionTemplate:
      "Shipment {tracking_number} is in transit to {destination}. We will update you when it arrives at port.",
    suggestedStatus: "in_transit",
  },
  {
    id: "at_port",
    label: "At port",
    title: "Arrived at port",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Shipment {tracking_number} has arrived at Tema Port. Customs clearance will begin shortly.",
    suggestedStatus: "at_port",
  },
  {
    id: "clearing",
    label: "Clearing",
    title: "Customs clearance",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Shipment {tracking_number} is clearing customs at Tema Port. We will notify you once cleared.",
    suggestedStatus: "clearing",
  },
  {
    id: "ready",
    label: "Ready",
    title: "Ready for pickup",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Shipment {tracking_number} is ready for pickup at Tema Port. Please contact our team to arrange collection.",
    suggestedStatus: "at_port",
  },
  {
    id: "delivered",
    label: "Delivered",
    title: "Delivered",
    location: "{destination}",
    descriptionTemplate:
      "Shipment {tracking_number} has been delivered. Thank you for choosing True Goshen.",
    suggestedStatus: "delivered",
  },
];

export const SHIPMENT_EVENT_PRESETS: ShipmentEventPreset[] = [
  {
    id: "order_confirmed",
    label: "Order confirmed",
    title: "Order confirmed",
    location: "",
    descriptionTemplate:
      "Your shipment {tracking_number} has been confirmed. We will keep you updated as it moves through each stage.",
    suggestedStatus: "pending",
  },
  {
    id: "vehicle_purchased",
    label: "Vehicle purchased",
    title: "Vehicle purchased",
    location: "{origin_country}",
    descriptionTemplate:
      "The vehicle for shipment {tracking_number} has been purchased at origin. Preparing export documentation next.",
    suggestedStatus: "pending",
  },
  {
    id: "preparing_shipment",
    label: "Preparing shipment",
    title: "Preparing shipment",
    location: "{origin_country}",
    descriptionTemplate:
      "We are preparing shipment {tracking_number} for export — documentation and loading arrangements are underway.",
    suggestedStatus: "booked",
  },
  {
    id: "payment_received",
    label: "Payment received",
    title: "Payment received",
    location: "",
    descriptionTemplate:
      "Payment for shipment {tracking_number} has been received. Thank you — we are preparing your booking.",
    suggestedStatus: "pending",
  },
  {
    id: "loaded_container",
    label: "Loaded into container",
    title: "Loaded into container",
    location: "{origin_country}",
    descriptionTemplate:
      "Your cargo for {tracking_number} has been loaded into the container. We will notify you once the vessel departs.",
    suggestedStatus: "booked",
  },
  {
    id: "container_departed",
    label: "Container departed",
    title: "Container departed",
    location: "{origin_country}",
    descriptionTemplate:
      "Container for {tracking_number} has departed. Your shipment is now on its way to {destination}.",
    suggestedStatus: "in_transit",
  },
  {
    id: "at_sea",
    label: "At sea / In transit",
    title: "In transit",
    location: "At sea",
    descriptionTemplate:
      "Shipment {tracking_number} is in transit to {destination}. We will update you when it arrives at port.",
    suggestedStatus: "in_transit",
  },
  {
    id: "arrived_port",
    label: "Arrived at port (Tema)",
    title: "Arrived at port",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Shipment {tracking_number} has arrived at Tema Port. Customs clearance will begin shortly.",
    suggestedStatus: "at_port",
  },
  {
    id: "awaiting_customs",
    label: "Awaiting customs clearance",
    title: "Awaiting customs clearance",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Shipment {tracking_number} is at Tema Port awaiting customs clearance. We will notify you once cleared.",
    suggestedStatus: "clearing",
  },
  {
    id: "customs_cleared",
    label: "Customs cleared",
    title: "Customs cleared",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Great news — shipment {tracking_number} has cleared customs and is ready for the next step.",
    suggestedStatus: "clearing",
  },
  {
    id: "ready_pickup",
    label: "Ready for pickup",
    title: "Ready for pickup",
    location: "Tema Port, Ghana",
    descriptionTemplate:
      "Shipment {tracking_number} is ready for pickup at Tema Port. Please contact our team to arrange collection.",
    suggestedStatus: "at_port",
  },
  {
    id: "delivered",
    label: "Delivered",
    title: "Delivered",
    location: "{destination}",
    descriptionTemplate:
      "Shipment {tracking_number} has been delivered. Thank you for choosing True Goshen — we appreciate your business.",
    suggestedStatus: "delivered",
  },
];

export function interpolatePresetText(
  template: string,
  context: ShipmentPresetContext
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = context[key as keyof ShipmentPresetContext];
    return value?.trim() ? value.trim() : `{${key}}`;
  });
}

export function applyPresetToForm(
  preset: ShipmentEventPreset,
  context: ShipmentPresetContext
): {
  title: string;
  description: string;
  location: string;
  is_customer_visible: boolean;
  suggestedStatus?: ShipmentStatus;
} {
  return {
    title: preset.title,
    description: interpolatePresetText(preset.descriptionTemplate, context),
    location: interpolatePresetText(preset.location, context).trim(),
    is_customer_visible: true,
    suggestedStatus: preset.suggestedStatus,
  };
}

export function presetContextFromShipment(shipment: {
  tracking_number: string;
  customer_name?: string | null;
  origin_country?: string | null;
  destination?: string | null;
  container_number?: string | null;
  vessel_name?: string | null;
  estimated_arrival?: string | null;
}): ShipmentPresetContext {
  return {
    tracking_number: shipment.tracking_number,
    customer_name: shipment.customer_name ?? undefined,
    origin_country: shipment.origin_country ?? undefined,
    destination: shipment.destination ?? "Ghana",
    container_number: shipment.container_number ?? undefined,
    vessel_name: shipment.vessel_name ?? undefined,
    estimated_arrival: shipment.estimated_arrival
      ? new Date(shipment.estimated_arrival).toLocaleDateString()
      : undefined,
  };
}
