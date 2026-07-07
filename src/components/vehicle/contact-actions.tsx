"use client";

import { Phone, MessageCircle, Calendar, FileText, Heart } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FullPageLink } from "@/components/shared/full-page-link";
import { useGarage } from "@/hooks/use-garage";
import { useCurrency } from "@/context/currency-context";
import {
  downPaymentUsd,
  canPreorder,
} from "@/lib/vehicles/availability";
import {
  GHANA_PHONE_TEL,
  GHANA_WHATSAPP,
} from "@/lib/data/vehicle-images";
import { AddToCompareButton } from "@/components/vehicle/add-to-compare-button";
import { ROUTES } from "@/lib/routes";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import { cn } from "@/lib/utils";

interface ContactActionsProps {
  vehicle: Vehicle;
}

export function ContactActions({ vehicle }: ContactActionsProps) {
  const { isSavedVehicle, toggleSave } = useGarage();
  const { formatPrice } = useCurrency();
  const saved = isSavedVehicle(vehicle);
  const showPreorder = canPreorder(vehicle.status);
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? GHANA_WHATSAPP;
  const downPayment = formatPrice(downPaymentUsd(vehicle.price));
  const whatsappMessage = encodeURIComponent(
    showPreorder
      ? `Hi, I'd like to pre-order the ${vehicle.year} ${vehicle.make} ${vehicle.model} (Stock #${vehicle.id}). Down payment: ${downPayment} (25%).`
      : `Hi, I'm interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model} (Stock #${vehicle.id}).`
  );

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        render={
          <FullPageLink href={`/contact?vehicle=${vehicle.slug}`} />
        }
      >
        <Calendar className="size-4" />
        {showPreorder ? "Schedule Consultation" : "Schedule Inspection"}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        render={<FullPageLink href={ROUTES.auto.financing} />}
      >
        <FileText className="size-4" />
        Request Financing
      </Button>
      <Button
        variant="outline"
        className="w-full"
        render={<a href={`tel:${GHANA_PHONE_TEL}`} />}
      >
        <Phone className="size-4" />
        Call Now
      </Button>
      <Button
        variant="outline"
        className="w-full"
        render={
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        <MessageCircle className="size-4" />
        WhatsApp Inquiry
      </Button>
      <AddToCompareButton
        vehicle={vehicle}
        onToggle={(action) => {
          if (action === "full") {
            window.alert("Compare list is full (max 4 vehicles). Remove one to add another.");
          }
        }}
      />
      <Button
        variant={saved ? "outline" : "secondary"}
        className={cn(
          "w-full transition-colors",
          saved && "border-brand-purple/30 text-brand-purple hover:bg-brand-purple/10 hover:text-brand-purple-dark"
        )}
        onClick={() => {
          const action = toggleSave(vehicle);
          if (action === "saved") {
            recordVehicleEngagement("save", vehicle);
          }
        }}
        aria-label={saved ? "Remove from saved vehicles" : "Save vehicle to garage"}
        aria-pressed={saved}
      >
        <Heart
          className={cn(
            "size-4",
            saved && "fill-brand-purple text-brand-purple"
          )}
        />
        {saved ? "Remove from Saved" : "Save Vehicle"}
      </Button>
    </div>
  );
}
