import { generateGeminiText } from "@/lib/ai/gemini";

export const CUSTOMER_NOTE_INTENTS = [
  {
    id: "status_update",
    label: "Status update",
    hint: "Plain-language update on where the shipment is now.",
  },
  {
    id: "next_steps",
    label: "Next steps",
    hint: "What the customer should do or expect next.",
  },
  {
    id: "eta_update",
    label: "ETA / timeline",
    hint: "Estimated arrival or delivery window.",
  },
  {
    id: "pickup_ready",
    label: "Ready for pickup",
    hint: "Vehicle or cargo ready with location and contact details.",
  },
] as const;

export type CustomerNoteIntent =
  | (typeof CUSTOMER_NOTE_INTENTS)[number]["id"]
  | "custom";

export type CustomerNoteFieldType =
  | "shipment_notes"
  | "timeline_event"
  | "freight_quote_reply";

export type CustomerNoteMode = "draft" | "improve";

export type CustomerNoteContext = {
  fieldType: CustomerNoteFieldType;
  mode: CustomerNoteMode;
  intent: CustomerNoteIntent;
  customPrompt?: string;
  existingDraft?: string;
  bulletPoints?: string;
  status?: string;
  customerName?: string;
  trackingNumber?: string;
  originCountry?: string;
  destination?: string;
  estimatedArrival?: string;
  vesselName?: string;
  containerNumber?: string;
  eventTitle?: string;
  eventLocation?: string;
  serviceType?: string;
  cargoDescription?: string;
  customerMessage?: string;
  timelineEvents?: Array<{
    title: string;
    description?: string | null;
    location?: string | null;
    event_at?: string;
  }>;
};

function fieldTypeLabel(fieldType: CustomerNoteFieldType): string {
  switch (fieldType) {
    case "shipment_notes":
      return "customer-visible shipment note";
    case "timeline_event":
      return "customer-visible timeline event description";
    case "freight_quote_reply":
      return "freight quote reply email";
    default:
      return "customer-facing note";
  }
}

function intentInstruction(intent: CustomerNoteIntent, customPrompt?: string): string {
  switch (intent) {
    case "status_update":
      return "Write a clear status update in plain language the customer can understand.";
    case "next_steps":
      return "Explain what happens next and any action the customer should take.";
    case "eta_update":
      return "Share an estimated timeline or arrival window. If exact dates are unknown, say the team is coordinating and will confirm soon.";
    case "pickup_ready":
      return "Tell the customer their shipment is ready for pickup or delivery, including location and how to reach the team if provided in context.";
    case "custom":
      return customPrompt?.trim() || "Draft a helpful customer-facing update from the admin's bullet points.";
    default:
      return "Draft a helpful customer-facing update.";
  }
}

export async function generateCustomerNoteDraft(context: CustomerNoteContext): Promise<string> {
  const instruction = intentInstruction(context.intent, context.customPrompt);
  const outputKind = fieldTypeLabel(context.fieldType);

  const systemPrompt = `You are a logistics coordinator for Nabus Motors, a premium vehicle import and freight business in Ghana and West Africa.
Write ${outputKind} text that will be shown directly to the customer on their tracking page or in a reply email.

Rules:
- Use plain, reassuring language — no internal codes, jargon, or staff-only details.
- Do NOT mention pricing disputes, margins, supplier issues, or confidential operational problems.
- Include specific dates, locations, and contact details only when provided in the context — never invent them.
- Keep it short (1–4 sentences for notes; up to 120 words for email replies).
- Professional, warm, and confident tone.
- Return ONLY the note text — no subject line, greeting, signature, or markdown.`;

  const contextLines = [
    context.customerName ? `Customer: ${context.customerName}` : "",
    context.trackingNumber ? `Tracking #: ${context.trackingNumber}` : "",
    context.status ? `Shipment status: ${context.status}` : "",
    context.originCountry ? `Origin: ${context.originCountry}` : "",
    context.destination ? `Destination: ${context.destination}` : "",
    context.estimatedArrival ? `Estimated arrival: ${context.estimatedArrival}` : "",
    context.vesselName ? `Vessel: ${context.vesselName}` : "",
    context.containerNumber ? `Container: ${context.containerNumber}` : "",
    context.eventTitle ? `Event title: ${context.eventTitle}` : "",
    context.eventLocation ? `Event location: ${context.eventLocation}` : "",
    context.serviceType ? `Freight service: ${context.serviceType.replace(/_/g, " ")}` : "",
    context.cargoDescription ? `Cargo: ${context.cargoDescription}` : "",
    context.customerMessage ? `Customer's original message:\n${context.customerMessage}` : "",
  ].filter(Boolean);

  if (context.timelineEvents?.length) {
    const recent = context.timelineEvents.slice(0, 5);
    contextLines.push(
      "Recent timeline (newest first):",
      ...recent.map(
        (e) =>
          `- ${e.title}${e.location ? ` (${e.location})` : ""}${e.description ? `: ${e.description}` : ""}`
      )
    );
  }

  const userPrompt = [
    context.mode === "improve"
      ? "Task: Improve the admin's draft professionally while keeping facts accurate."
      : `Task: ${instruction}`,
    context.bulletPoints?.trim()
      ? `\nAdmin's rough notes / bullet points:\n${context.bulletPoints.trim()}`
      : "",
    context.existingDraft?.trim()
      ? `\nCurrent draft:\n${context.existingDraft.trim()}`
      : "",
    contextLines.length ? `\nContext:\n${contextLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await generateGeminiText([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  return raw.trim().replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/i, "");
}
