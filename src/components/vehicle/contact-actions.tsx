"use client";

import { Phone, MessageCircle, Calendar, FileText, Heart } from "lucide-react";
import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useGarage } from "@/hooks/use-garage";
import {
  GHANA_PHONE_TEL,
  GHANA_WHATSAPP,
} from "@/lib/data/vehicle-images";
import { cn } from "@/lib/utils";

interface ContactActionsProps {
  vehicle: Vehicle;
}

export function ContactActions({ vehicle }: ContactActionsProps) {
  const { isSaved, toggleSave } = useGarage();
  const saved = isSaved(vehicle.id);
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? GHANA_WHATSAPP;
  const whatsappMessage = encodeURIComponent(
    `Hi, I'm interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model} (Stock #${vehicle.id}).`
  );

  return (
    <div className="space-y-3">
      <Button className="w-full" render={<Link href={`/contact?vehicle=${vehicle.slug}`} />}>
        <Calendar className="size-4" />
        Schedule Inspection
      </Button>
      <Button
        variant="outline"
        className="w-full"
        render={<Link href="/financing" />}
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
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => toggleSave(vehicle)}
      >
        <Heart className={cn("size-4", saved && "fill-red-500 text-red-500")} />
        {saved ? "Saved to Garage" : "Save Vehicle"}
      </Button>
    </div>
  );
}
