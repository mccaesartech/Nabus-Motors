"use client";

import { useState } from "react";
import {
  ServiceImageCardGrid,
  type ServiceImageCardData,
} from "@/components/shared/service-image-card";
import { FreightAdviceMessagePanel } from "@/components/freight/freight-advice-message-panel";

const ADVICE_CARD_ID = "advice";

type FreightServiceCardsProps = {
  cards: ServiceImageCardData[];
  className?: string;
};

export function FreightServiceCards({ cards, className }: FreightServiceCardsProps) {
  const [adviceOpen, setAdviceOpen] = useState(false);

  const mappedCards = cards.map((card) =>
    card.id === ADVICE_CARD_ID
      ? { ...card, href: undefined, onClick: () => setAdviceOpen(true) }
      : card
  );

  return (
    <>
      <ServiceImageCardGrid cards={mappedCards} className={className} />
      <FreightAdviceMessagePanel open={adviceOpen} onOpenChange={setAdviceOpen} />
    </>
  );
}
