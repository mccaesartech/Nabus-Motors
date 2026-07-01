import { ShipmentManager } from "@/components/platform/shipment-manager";

export default function ImportTrackingPage() {
  return (
    <ShipmentManager
      title="Import Tracking"
      description="Track vehicle imports from origin port to Ghana delivery for pre-orders and inventory."
      breadcrumb="Import Tracking"
      referenceType="preorder"
    />
  );
}
