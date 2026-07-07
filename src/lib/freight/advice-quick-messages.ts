export const FREIGHT_ADVICE_QUICK_MESSAGES = [
  "Where is my shipment now?",
  "When will my cargo arrive?",
  "I need an update on customs clearance",
  "Can I change delivery address?",
  "What documents do I need?",
  "I have a question about my quote",
] as const;

export type FreightAdviceQuickMessage =
  (typeof FREIGHT_ADVICE_QUICK_MESSAGES)[number];
