import "server-only";

import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  AI_USAGE_LOG_TABLE,
  type AiUsageAction,
  type AiUsageStatus,
  truncateAiPreview,
} from "@/lib/ai/usage-log-shared";
import {
  isMissingRelationError,
  markSchemaMissing,
  markSchemaPresent,
  SCHEMA_CAPS,
  isSchemaMissing,
} from "@/lib/observability/schema-capability";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type LogAiUsageInput = {
  auth: PlatformAuthContext | null;
  action: AiUsageAction | string;
  status?: AiUsageStatus;
  vehicleId?: string | null;
  vehicleSlug?: string | null;
  vehicleLabel?: string | null;
  previewSnippet?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

function isTableMissing(error: { code?: string | null; message?: string | null }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    isMissingRelationError(error.message, AI_USAGE_LOG_TABLE)
  );
}

/** Fire-and-forget insert — never throws to callers. */
export async function logAiUsage(input: LogAiUsageInput): Promise<void> {
  if (isSchemaMissing(SCHEMA_CAPS.aiUsageLogs)) return;

  const supabase = createAdminSupabase();
  if (!supabase) return;

  const auth = input.auth;
  const row = {
    actor_user_id: auth?.type === "user" ? auth.userId ?? null : null,
    actor_name: auth?.name ?? "Owner",
    actor_email: auth?.email ?? null,
    actor_role: auth?.role ?? (auth?.type === "owner" ? "owner" : null),
    action: String(input.action).slice(0, 80),
    status: input.status ?? "success",
    vehicle_id: input.vehicleId?.trim() || null,
    vehicle_slug: input.vehicleSlug?.trim() || null,
    vehicle_label: truncateAiPreview(input.vehicleLabel, 120),
    preview_snippet: truncateAiPreview(input.previewSnippet),
    error_message: truncateAiPreview(input.errorMessage, 400),
    metadata: input.metadata ?? {},
  };

  const { error } = await supabase.from(AI_USAGE_LOG_TABLE).insert(row);
  if (error) {
    if (isTableMissing(error)) {
      markSchemaMissing(SCHEMA_CAPS.aiUsageLogs);
      return;
    }
    console.error("ai_usage_logs insert failed:", error.message);
    return;
  }
  markSchemaPresent(SCHEMA_CAPS.aiUsageLogs);
}

export {
  AI_USAGE_ACTIONS,
  AI_USAGE_ACTION_LABELS,
  AI_USAGE_LOG_TABLE,
  AI_USAGE_MIGRATION_REQUIRED_MESSAGE,
  aiUsageActionLabel,
  buildVehicleAiLabel,
  inferAiChatAction,
  isAiUsageAction,
  truncateAiPreview,
  type AiUsageAction,
  type AiUsageLogRow,
  type AiUsageStatus,
} from "@/lib/ai/usage-log-shared";
