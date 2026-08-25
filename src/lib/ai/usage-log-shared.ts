export const AI_USAGE_ACTIONS = [
  "ai_chat",
  "fill_from_photos",
  "detect_color",
  "generate_description",
  "improve_description",
  "analyze_image",
  "edit_image",
  "enhance_image",
  "suggest_photos",
  "verify_images",
  "ai_assist",
  "whatsapp_assist",
] as const;

export type AiUsageAction = (typeof AI_USAGE_ACTIONS)[number];

export type AiUsageStatus = "success" | "error" | "partial";

export const AI_USAGE_ACTION_LABELS: Record<AiUsageAction, string> = {
  ai_chat: "AI chat",
  fill_from_photos: "Fill listing from photos",
  detect_color: "Detect exterior color",
  generate_description: "Generate description",
  improve_description: "Improve description",
  analyze_image: "Analyze image",
  edit_image: "Edit image (filter)",
  enhance_image: "Enhance image (4K)",
  suggest_photos: "Suggest stock photos",
  verify_images: "Verify listing photos",
  ai_assist: "One-shot AI assist",
  whatsapp_assist: "WhatsApp customer assist",
};

export type AiUsageLogRow = {
  id: string;
  created_at: string;
  deleted_at: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  status: AiUsageStatus;
  vehicle_id: string | null;
  vehicle_slug: string | null;
  vehicle_label: string | null;
  preview_snippet: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export const AI_USAGE_LOG_TABLE = "ai_usage_logs";

export const AI_USAGE_MIGRATION_REQUIRED_MESSAGE =
  "AI usage history is not persisted yet. Run supabase/migrations/095_ai_usage_logs.sql in the Supabase SQL Editor.";

export function isAiUsageAction(value: string): value is AiUsageAction {
  return (AI_USAGE_ACTIONS as readonly string[]).includes(value);
}

export function aiUsageActionLabel(action: string): string {
  return isAiUsageAction(action) ? AI_USAGE_ACTION_LABELS[action] : action;
}

export function buildVehicleAiLabel(vehicle: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
}): string | null {
  const year = vehicle.year != null && String(vehicle.year).trim() ? String(vehicle.year).trim() : "";
  const make = vehicle.make?.trim() ?? "";
  const model = vehicle.model?.trim() ?? "";
  const label = [year, make, model].filter(Boolean).join(" ").trim();
  return label || null;
}

/** Infer a more specific action from the last user prompt when logging ai-chat. */
export function inferAiChatAction(userMessage: string): AiUsageAction {
  const text = userMessage.toLowerCase();
  if (text.includes("fill listing from photos") || text.includes("fill from photos")) {
    return "fill_from_photos";
  }
  if (text.includes("detect exterior color") || text.includes("detect color")) {
    return "detect_color";
  }
  if (text.includes("improve") && text.includes("description")) {
    return "improve_description";
  }
  if (
    (text.includes("write") || text.includes("generate") || text.includes("draft")) &&
    text.includes("description")
  ) {
    return "generate_description";
  }
  if (text.includes("correct fields from photos") || text.includes("analyze")) {
    return "analyze_image";
  }
  return "ai_chat";
}

export function truncateAiPreview(text: string | null | undefined, max = 240): string | null {
  if (!text) return null;
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 3) + "...";
}
