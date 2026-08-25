import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  SCHEMA_CAPS,
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";
import type { AuditAction } from "./actions";
import { redactAuditMetadata } from "./redact";
import {
  auditContextFromRequest,
  type AuditRequestContext,
} from "./request-context";

export const AUDIT_LOG_TABLE = "audit_logs";

export type WriteAuditLogInput = {
  action: AuditAction | string;
  success: boolean;
  actor?: PlatformAuthContext | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request | null;
  /** Override when request is unavailable (e.g. background after()). */
  context?: Partial<AuditRequestContext> | null;
};

export type { AuditLogRow } from "./types";


let persistDisabled = false;

function resolveActor(input: WriteAuditLogInput): {
  actorUserId: string | null;
  actorName: string | null;
  actorRole: string | null;
} {
  const auth = input.actor ?? null;
  return {
    actorUserId:
      input.actorUserId ??
      (auth?.type === "user" ? (auth.userId ?? null) : auth?.type === "owner" ? "owner" : null),
    actorName: input.actorName ?? auth?.name ?? null,
    actorRole: input.actorRole ?? auth?.role ?? null,
  };
}

/**
 * Persist an audit event. Never throws to callers — failures are swallowed
 * and logged to the console so primary business flows keep working.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    if (persistDisabled || isSchemaMissing(SCHEMA_CAPS.auditLogs)) return;

    const supabase = createAdminSupabase();
    if (!supabase) return;

    const fromRequest = auditContextFromRequest(input.request ?? null);
    const ctx: AuditRequestContext = {
      ...fromRequest,
      ...(input.context ?? {}),
      ipAddress: input.context?.ipAddress ?? fromRequest.ipAddress,
      userAgent: input.context?.userAgent ?? fromRequest.userAgent,
      browser: input.context?.browser ?? fromRequest.browser,
      operatingSystem: input.context?.operatingSystem ?? fromRequest.operatingSystem,
      requestId: input.context?.requestId ?? fromRequest.requestId,
      country: input.context?.country ?? fromRequest.country,
      region: input.context?.region ?? fromRequest.region,
      city: input.context?.city ?? fromRequest.city,
    };

    const actor = resolveActor(input);
    const row = {
      actor_user_id: actor.actorUserId,
      actor_name: actor.actorName,
      actor_role: actor.actorRole,
      action: String(input.action).slice(0, 120),
      target_type: input.targetType?.slice(0, 120) ?? null,
      target_id: input.targetId?.slice(0, 200) ?? null,
      target_name: input.targetName?.slice(0, 300) ?? null,
      ip_address: ctx.ipAddress,
      user_agent: ctx.userAgent,
      browser: ctx.browser,
      operating_system: ctx.operatingSystem,
      request_id: ctx.requestId,
      success: Boolean(input.success),
      error_message: input.errorMessage?.slice(0, 2000) ?? null,
      metadata: redactAuditMetadata(input.metadata ?? {}),
      country: ctx.country?.slice(0, 80) ?? null,
      region: ctx.region?.slice(0, 120) ?? null,
      city: ctx.city?.slice(0, 120) ?? null,
    };

    const { error } = await supabase.from(AUDIT_LOG_TABLE).insert(row);
    if (error) {
      if (isMissingRelationError(error.message) || error.code === "42P01" || error.code === "PGRST205") {
        markSchemaMissing(SCHEMA_CAPS.auditLogs);
        persistDisabled = true;
        console.warn(
          "[audit] audit_logs table missing — run supabase/migrations/093_audit_logs.sql. Persistence disabled for this instance."
        );
        return;
      }
      console.error("[audit] writeAuditLog insert failed:", error.message);
      return;
    }

    markSchemaPresent(SCHEMA_CAPS.auditLogs);
  } catch (error) {
    console.error(
      "[audit] writeAuditLog failed:",
      error instanceof Error ? error.message : error
    );
  }
}

/** Fire-and-forget wrapper for route handlers that should not await audit I/O. */
export function enqueueAuditLog(input: WriteAuditLogInput): void {
  void writeAuditLog(input);
}
