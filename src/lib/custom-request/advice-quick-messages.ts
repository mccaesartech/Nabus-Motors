export const CUSTOM_REQUEST_QUICK_MESSAGES = [
  "Any update on my vehicle request?",
  "I found another option — can you source it?",
  "Can you share estimated timeline and pricing?",
  "I'd like to adjust my budget or specifications.",
] as const;

export type CustomRequestQuickMessage =
  (typeof CUSTOM_REQUEST_QUICK_MESSAGES)[number];
