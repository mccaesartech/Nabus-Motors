import { getSiteContent } from "@/lib/site-content";
import { FreightTrackingClient } from "./freight-tracking-client";

export const metadata = {
  title: "Shipment Tracking",
  description: "Track your Nabus Motors shipment status and timeline.",
};

export default async function FreightTrackingPage() {
  const content = await getSiteContent();
  return <FreightTrackingClient pageContent={content.freightTracking} />;
}
