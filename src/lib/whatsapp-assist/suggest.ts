import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateGeminiText,
  geminiErrorToHttp,
  getGeminiApiKey,
  getGeminiKeyWarning,
} from "@/lib/ai/gemini";
import { logAiUsage } from "@/lib/ai/usage-log";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  factsToPromptPayload,
  inferMissingFields,
  loadWhatsAppCustomerFacts,
} from "@/lib/whatsapp-assist/context";
import type {
  WhatsAppConversationTurn,
  WhatsAppSuggestRequest,
  WhatsAppSuggestResult,
} from "@/lib/whatsapp-assist/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
}

function parseSuggestResponse(raw: string): WhatsAppSuggestResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const missingFields = parseStringArray(parsed.missingFields);
    const needsClarification = Boolean(parsed.needsClarification);
    const suggestedMessage =
      typeof parsed.suggestedMessage === "string" ? parsed.suggestedMessage.trim() : "";

    return {
      contextSummary:
        typeof parsed.contextSummary === "string"
          ? parsed.contextSummary.trim()
          : "Customer context loaded from platform records.",
      followUpReason:
        typeof parsed.followUpReason === "string"
          ? parsed.followUpReason.trim()
          : "General follow-up",
      suggestedMessage,
      missingFields,
      needsClarification,
    };
  } catch {
    return {
      contextSummary: "Could not parse AI response.",
      followUpReason: "Manual review required",
      suggestedMessage: cleaned.slice(0, 2000),
      missingFields: [],
      needsClarification: true,
    };
  }
}

const SYSTEM_PROMPT = `You are a WhatsApp communication assistant for Nabus Motors staff in Ghana.

You will receive a JSON object named FACTS containing ONLY verified database records about a customer.
You must NEVER invent prices, dates, tracking numbers, payment amounts, vehicle specs, or delivery status.

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "contextSummary": "2-4 sentences summarizing the customer situation using ONLY facts provided",
  "followUpReason": "One sentence: why staff should reach out now",
  "suggestedMessage": "Professional WhatsApp message ready to send (plain text, no markdown)",
  "missingFields": ["list of facts staff should clarify before sending, if any"],
  "needsClarification": true or false
}

Rules:
- Write in warm, professional English suitable for Ghana business WhatsApp.
- Keep suggestedMessage under 600 characters unless staff instructions ask for more detail.
- Use the customer's first name when known.
- Sign off as Nabus Motors and Trading (not as AI, and never as owner, manager, staff, or any internal role).
- Never mention internal roles (owner, super admin, manager, staff) or individual staff names in suggestedMessage.
- If FACTS lack information needed for a specific claim (payment received, exact quote amount, delivery date, clearing status), set needsClarification true and start suggestedMessage with "Need clarification:" listing what staff must confirm.
- Do NOT guess payment status, shipment ETA, or quote pricing — only state what appears in FACTS.
- For reply mode, respond to lastCustomerMessage using FACTS and conversationHistory only.
- If whatsappOptIn is false, note in missingFields that customer has not opted in to WhatsApp updates.
- Never mention internal systems, AI, or database fields to the customer in suggestedMessage.`;

export async function generateWhatsAppSuggestion(
  supabase: SupabaseClient,
  input: WhatsAppSuggestRequest,
  auth: PlatformAuthContext
): Promise<
  | {
      ok: true;
      configured: boolean;
      result: WhatsAppSuggestResult;
      factsPayload: Record<string, unknown>;
      keyWarning?: string;
    }
  | { ok: false; configured: boolean; message: string; status: number }
> {
  const facts = await loadWhatsAppCustomerFacts(supabase, input);

  const factsPayload = factsToPromptPayload(facts, {
    mode: input.mode,
    lastCustomerMessage: input.lastCustomerMessage,
    staffInstructions: input.staffInstructions,
  });

  const serverMissing = inferMissingFields(facts);
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    const fallbackMessage = facts.customer.name
      ? `Hi ${facts.customer.name.split(/\s+/)[0]}, this is Nabus Motors following up on your inquiry. Please let us know if you have any questions.`
      : "Hi, this is Nabus Motors following up on your inquiry. Please let us know if you have any questions.";

    void logAiUsage({
      auth,
      action: "whatsapp_assist",
      status: "partial",
      previewSnippet: fallbackMessage,
      errorMessage: "GEMINI_API_KEY not configured",
      metadata: { source: "whatsapp-assist", configured: false },
    });

    return {
      ok: true,
      configured: false,
      result: {
        contextSummary: facts.focusLabel
          ? `Follow-up for ${facts.focusLabel}.`
          : "Customer profile loaded ΓÇö no AI summary available without Gemini key.",
        followUpReason: facts.focusLabel ?? "General customer follow-up",
        suggestedMessage: fallbackMessage,
        missingFields: serverMissing,
        needsClarification: serverMissing.length > 0,
      },
      factsPayload,
    };
  }

  const keyWarning = getGeminiKeyWarning();
  const userPrompt = JSON.stringify({ FACTS: factsPayload }, null, 2);

  try {
    const raw = await generateGeminiText(
      [{ text: SYSTEM_PROMPT }, { text: userPrompt }],
      { temperature: 0.35, jsonMode: true }
    );

    const result = parseSuggestResponse(raw);
    const mergedMissing = Array.from(new Set([...serverMissing, ...result.missingFields]));

    void logAiUsage({
      auth,
      action: "whatsapp_assist",
      status: "success",
      previewSnippet: result.suggestedMessage,
      metadata: {
        source: "whatsapp-assist",
        mode: input.mode ?? "initial",
        focus: facts.focusLabel,
        missingCount: mergedMissing.length,
      },
    });

    return {
      ok: true,
      configured: true,
      result: {
        ...result,
        missingFields: mergedMissing,
        needsClarification: result.needsClarification || mergedMissing.length > 0,
      },
      factsPayload,
      ...(keyWarning ? { keyWarning } : {}),
    };
  } catch (err) {
    const { message, status } = geminiErrorToHttp(err);
    void logAiUsage({
      auth,
      action: "whatsapp_assist",
      status: "error",
      previewSnippet: input.lastCustomerMessage ?? input.customerName ?? null,
      errorMessage: message,
      metadata: { source: "whatsapp-assist" },
    });
    return { ok: false, configured: status !== 503, message, status };
  }
}

export function sanitizeSuggestRequest(body: unknown): WhatsAppSuggestRequest | null {
  if (!isRecord(body)) return null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone) return null;

  const conversationHistory = Array.isArray(body.conversationHistory)
    ? body.conversationHistory
        .filter(isRecord)
        .map((turn): WhatsAppConversationTurn => ({
          role:
            turn.role === "customer" || turn.role === "staff" || turn.role === "system"
              ? turn.role
              : "staff",
          body: typeof turn.body === "string" ? turn.body.trim().slice(0, 4000) : "",
          at: typeof turn.at === "string" ? turn.at : null,
          source: typeof turn.source === "string" ? turn.source : null,
        }))
        .filter((turn) => turn.body.length > 0)
        .slice(-20)
    : undefined;

  return {
    phone,
    customerName: typeof body.customerName === "string" ? body.customerName : undefined,
    customerId: typeof body.customerId === "string" ? body.customerId : undefined,
    userId: typeof body.userId === "string" ? body.userId : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    contextType:
      body.contextType === "customer" ||
      body.contextType === "preorder" ||
      body.contextType === "order" ||
      body.contextType === "quote" ||
      body.contextType === "shipment" ||
      body.contextType === "inquiry"
        ? body.contextType
        : undefined,
    contextId: typeof body.contextId === "string" ? body.contextId : undefined,
    inquiryType: typeof body.inquiryType === "string" ? body.inquiryType : undefined,
    mode: body.mode === "reply" ? "reply" : "initial",
    lastCustomerMessage:
      typeof body.lastCustomerMessage === "string" ? body.lastCustomerMessage : undefined,
    staffInstructions:
      typeof body.staffInstructions === "string" ? body.staffInstructions : undefined,
    conversationHistory,
  };
}
