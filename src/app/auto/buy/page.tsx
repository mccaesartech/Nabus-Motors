import { getSiteContent } from "@/lib/site-content";
import { ImportWizard } from "@/components/auto/import-wizard";

export const metadata = {
  title: "Buy a Vehicle",
  description:
    "Find your next vehicle with verified inventory, transparent pricing, and professional support.",
};

export default async function BuyPage() {
  const content = await getSiteContent();
  return <ImportWizard hero={content.buy} />;
}
