import { describe, expect, it } from "vitest";
import {
  DEFAULT_START_YOUR_JOURNEY,
  mergeDivisionLandingCards,
  mergeStartYourJourneyAdvisor,
} from "@/lib/site-content/corporate-defaults";
import { mergeSiteContent } from "@/lib/site-content/defaults";

describe("startYourJourney site content", () => {
  it("merges tile image and CTA overrides by id", () => {
    const merged = mergeDivisionLandingCards(DEFAULT_START_YOUR_JOURNEY.cards, [
      {
        id: "freight",
        image: "https://cdn.example.com/freight.jpg",
        cta: "Get a freight quote",
        title: "Freight & Customs Clearing",
      },
      {
        id: "unknown-tile",
        title: "Should be ignored",
      },
    ]);

    const freight = merged.find((card) => card.id === "freight");
    expect(freight?.image).toBe("https://cdn.example.com/freight.jpg");
    expect(freight?.cta).toBe("Get a freight quote");
    expect(freight?.title).toBe("Freight & Customs Clearing");
    expect(freight?.href).toBe(DEFAULT_START_YOUR_JOURNEY.cards[2].href);
    expect(merged).toHaveLength(DEFAULT_START_YOUR_JOURNEY.cards.length);
  });

  it("merges advisor image and labels with defaults for empty fields", () => {
    const merged = mergeStartYourJourneyAdvisor(DEFAULT_START_YOUR_JOURNEY.advisor, {
      image: "https://cdn.example.com/advisor.jpg",
      primaryLabel: "Chat on WhatsApp",
      title: "",
    });

    expect(merged.image).toBe("https://cdn.example.com/advisor.jpg");
    expect(merged.primaryLabel).toBe("Chat on WhatsApp");
    expect(merged.title).toBe(DEFAULT_START_YOUR_JOURNEY.advisor.title);
    expect(merged.secondaryHref).toBe(DEFAULT_START_YOUR_JOURNEY.advisor.secondaryHref);
  });

  it("loads startYourJourney through mergeSiteContent", () => {
    const content = mergeSiteContent({
      startYourJourney: {
        title: "Need help today?",
        cards: [
          {
            id: "buy-vehicle",
            image: "https://cdn.example.com/buy.jpg",
          },
        ],
        advisor: {
          image: "https://cdn.example.com/advisor.jpg",
        },
      },
    });

    expect(content.startYourJourney.title).toBe("Need help today?");
    expect(content.startYourJourney.description).toBe(
      DEFAULT_START_YOUR_JOURNEY.description
    );
    expect(content.startYourJourney.cards[0].image).toBe("https://cdn.example.com/buy.jpg");
    expect(content.startYourJourney.cards[0].title).toBe(
      DEFAULT_START_YOUR_JOURNEY.cards[0].title
    );
    expect(content.startYourJourney.advisor.image).toBe(
      "https://cdn.example.com/advisor.jpg"
    );
    expect(content.startYourJourney.advisor.title).toBe(
      DEFAULT_START_YOUR_JOURNEY.advisor.title
    );
  });
});
