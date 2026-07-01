import { getSiteContent } from "@/lib/site-content";
import { SellPageClient } from "./sell-client";

export const metadata = {
  title: "Sell Your Vehicle",
  description: "Get a fair market appraisal and sell your vehicle through True Goshen Auto.",
};

export default async function SellPage() {
  const content = await getSiteContent();
  return <SellPageClient hero={content.sell} />;
}
