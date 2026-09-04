import { generateGeminiText } from "@/lib/ai/gemini";

export const CUSTOMER_REPLY_INTENTS = [
  {
    id: "confirm_preorder",
    label: "Confirm pre-order",
    hint: "Acknowledge their pre-order and outline next steps.",
  },
  {
    id: "request_payment",
    label: "Request payment",
    hint: "Politely request deposit or balance payment with clear instructions.",
  },
  {
    id: "delivery_update",
    label: "Share delivery update",
    hint: "Provide a reassuring shipping or delivery timeline update.",
  },
  {
    id: "polite_followup",
    label: "Polite follow-up",
    hint: "Warm follow-up when waiting on customer response or documents.",
  },
] as const;

export type CustomerReplyIntent =
  | (typeof CUSTOMER_REPLY_INTENTS)[number]["id"]
  | "custom";

export type CustomerReplyContext = {
  customerName: string;
  email: string;
  subject: string;
  body: string;
  category: string;
  intent: CustomerReplyIntent;
  customPrompt?: string;
  existingDraft?: string;
};

function intentInstruction(intent: CustomerReplyIntent, customPrompt?: string): string {
  switch (intent) {
    case "confirm_preorder":
      return "Confirm their pre-order interest, thank them, and briefly explain what happens next (processing review, deposit, or documentation).";
    case "request_payment":
      return "Politely request payment (deposit or balance). Mention they can reply with questions. Do not invent specific bank details — say our team will share payment instructions separately if needed.";
    case "delivery_update":
      return "Share a professional delivery or shipping update. If timing is unknown, say the team is coordinating and will confirm dates soon.";
    case "polite_followup":
      return "Send a courteous follow-up checking whether they need anything else or have questions about their purchase.";
    case "custom":
      return customPrompt?.trim() || "Draft a helpful, professional reply to their message.";
    default:
      return "Draft a helpful, professional reply to their message.";
  }
}

export async function generateCustomerReplyDraft(
  context: CustomerReplyContext
): Promise<string> {
  const instruction = intentInstruction(context.intent, context.customPrompt);

  const systemPrompt = `You are a customer success specialist for Nabus Motors, a premium vehicle dealership in Ghana and West Africa.
Write a reply email/message to a registered customer. Tone: professional, warm, trustworthy, concise.
Rules:
- Address the customer by first name when possible.
- Reference their subject and message so the reply feels personal.
- Do not invent specific prices, VINs, delivery dates, or payment account numbers unless provided in the customer message.
- Return ONLY the reply body text — no subject line, no "Dear...", no signature block, no markdown.
- Keep replies under 180 words unless the situation clearly needs more detail.
- Use plain paragraphs; no bullet lists unless the customer asked for steps.`;

  const customerContext = [
    `Customer: ${context.customerName}`,
    `Email: ${context.email}`,
    `Category: ${context.category}`,
    `Subject: ${context.subject}`,
    `Message:\n${context.body}`,
  ].join("\n");

  const userPrompt = [
    `Task: ${instruction}`,
    context.existingDraft?.trim()
      ? `\nAdmin's current draft (improve or replace as appropriate):\n${context.existingDraft.trim()}`
      : "",
    `\n${customerContext}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await generateGeminiText([
    { text: systemPrompt },
    { text: userPrompt },
  ]);

  return raw.trim().replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/i, "");
}
