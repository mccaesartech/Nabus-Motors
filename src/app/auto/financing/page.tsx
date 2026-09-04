import { getSiteContent } from "@/lib/site-content";
import { FinancingPageClient } from "./financing-client";

export const metadata = {
  title: "Financing",
  description: "Flexible vehicle financing options from Nabus Motors.",
};

export default async function FinancingPage() {
  const content = await getSiteContent();
  return <FinancingPageClient hero={content.financing} />;
}
