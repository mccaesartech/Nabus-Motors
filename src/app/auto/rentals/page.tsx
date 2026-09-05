import Link from "next/link";
import { Car } from "lucide-react";
import { Container } from "@/components/shared/container";
import { NabusEmptyState } from "@/components/nabus/nabus-empty-state";
import { NabusPageHeader } from "@/components/nabus/nabus-page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { whatsappUrl } from "@/lib/constants";

export const metadata = {
  title: "Rentals",
  description: "Vehicle rental services from Nabus Motors — coming soon.",
};

export default function RentalsPage() {
  return (
    <div className="py-10 sm:py-14">
      <Container>
        <NabusPageHeader
          eyebrow="Rentals"
          title="Drive without commitment"
          description="Short-term and long-term vehicle rentals are on the way. Register your interest and we'll notify you when bookings open."
        />
        <NabusEmptyState
          icon={Car}
          title="Rentals launching soon"
          description="We're preparing a curated fleet for daily, weekly, and monthly rentals. In the meantime, browse our inventory or speak with an advisor."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                className="rounded-none bg-[var(--nabus-wine)]"
                render={<Link href={ROUTES.auto.inventory} />}
              >
                Open the catalogue
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                render={
                  <a
                    href={whatsappUrl("Hello Nabus Motors, I'm interested in vehicle rentals.")}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Register Interest
              </Button>
            </div>
          }
        />
      </Container>
    </div>
  );
}
