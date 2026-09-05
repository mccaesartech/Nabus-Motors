import { getSiteContent } from "@/lib/site-content";
import { ImportWizard } from "@/components/auto/import-wizard";

export const metadata = {
  title: "Request a Vehicle",
  description:
    "Can't find your car in our inventory? Tell us what you want and our team will follow up.",
};

export default async function CustomVehicleRequestPage() {
  const content = await getSiteContent();
  return (
    <ImportWizard
      hero={{
        title: "Request a Vehicle",
        subtitle:
          content.inventoryPage?.subtitle ??
          "Tell us what you need — we will source, import, and deliver to Ghana.",
      }}
    />
  );
}
