import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { AUDIT_ACTION_LABELS, isAuditAction } from "@/lib/audit/actions";
import { AUDIT_LOG_TABLE } from "@/lib/audit/write";
import type { AuditLogRow } from "@/lib/audit/types";
import {
  BATCH_CONCURRENCY,
  buildEntityLabel,
  mapPool,
  normalizeBatchIds,
  recordTrashEntry,
} from "@/lib/platform/trash";

/** Audit log bulk delete allows larger batches than generic trash ops (default 100). */
export const AUDIT_LOG_DELETE_BATCH_MAX = 500;

function auditLogLabel(row: Record<string, unknown>): string {
  const actionRaw = String(row.action ?? "Audit event");
  const action = isAuditAction(actionRaw)
    ? AUDIT_ACTION_LABELS[actionRaw]
    : actionRaw;
  const actor = String(row.actor_name ?? row.actor_role ?? "").trim();
  const target = String(row.target_name ?? row.target_id ?? "").trim();
  if (actor && target) return `${action} - ${actor} -> ${target}`;
  if (actor) return `${action} - ${actor}`;
  if (target) return `${action} - ${target}`;
  return action;
}

async function findActiveAuditLogTrash(
  supabase: SupabaseClient,
  entityId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("platform_trash")
    .select("id")
    .eq("entity_type", "audit_log")
    .eq("entity_id", entityId)
    .is("restored_at", null)
    .is("permanently_deleted_at", null)
    .limit(1)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

async function rollbackAuditLogTrashEntry(
  supabase: SupabaseClient,
  trashId: string
): Promise<void> {
  await supabase.from("platform_trash").delete().eq("id", trashId);
}

/** Audit log ids currently in trash (includes permanently deleted tombstones). */
export async function listTrashedAuditLogIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("platform_trash")
    .select("entity_id")
    .eq("entity_type", "audit_log")
    .is("restored_at", null);

  if (error) {
    console.error("[audit_log trash] list failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.entity_id)));
}

export function filterOutTrashedAuditLogs<T extends { id: string }>(
  rows: T[],
  trashedIds: Set<string>
): T[] {
  if (trashedIds.size === 0) return rows;
  return rows.filter((row) => !trashedIds.has(row.id));
}

/**
 * Move one audit log entry to platform_trash and remove it from audit_logs
 * (same pattern as sent_email / notification_log).
 */
export async function softDeleteAuditLog(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  id: string,
  snapshot?: Record<string, unknown>
): Promise<{ ok: true; trashId: string } | { ok: false; message: string; status?: number }> {
  const logId = id.trim();
  if (!logId) {
    return { ok: false, message: "Missing id", status: 400 };
  }

  const already = await findActiveAuditLogTrash(supabase, logId);
  if (already) {
    return { ok: false, message: "Audit log entry is already in trash.", status: 400 };
  }

  let row = snapshot;
  if (!row || Object.keys(row).length === 0) {
    const { data, error } = await supabase
      .from(AUDIT_LOG_TABLE)
      .select("*")
      .eq("id", logId)
      .maybeSingle();

    if (error) return { ok: false, message: error.message, status: 500 };
    if (!data) return { ok: false, message: "Audit log entry not found.", status: 404 };
    row = data as Record<string, unknown>;
  }

  const entityLabel = buildEntityLabel("audit_log", row);
  const trash = await recordTrashEntry(
    supabase,
    auth,
    "audit_log",
    logId,
    entityLabel,
    row
  );
  if (!trash.ok) {
    return { ok: false, message: trash.message, status: 500 };
  }

  const { error: deleteError } = await supabase.from(AUDIT_LOG_TABLE).delete().eq("id", logId);
  if (deleteError) {
    await rollbackAuditLogTrashEntry(supabase, trash.id);
    return { ok: false, message: deleteError.message, status: 500 };
  }

  return { ok: true, trashId: trash.id };
}

export async function softDeleteAuditLogs(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  ids: string[],
  snapshotsById?: Record<string, Record<string, unknown>>
): Promise<{
  deletedIds: string[];
  failed: Array<{ id: string; message: string }>;
  truncatedCount: number;
}> {
  const normalized = normalizeBatchIds(ids, AUDIT_LOG_DELETE_BATCH_MAX);
  const requestedUnique = normalizeBatchIds(ids, Number.MAX_SAFE_INTEGER).length;
  const truncatedCount = Math.max(0, requestedUnique - normalized.length);
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];

  if (truncatedCount > 0) {
    failed.push({
      id: "*",
      message: `Only the first ${AUDIT_LOG_DELETE_BATCH_MAX} unique ids were processed (${truncatedCount} omitted). Delete in smaller batches or run again.`,
    });
  }

  if (normalized.length === 0) {
    return { deletedIds, failed, truncatedCount };
  }

  const results = await mapPool(normalized, BATCH_CONCURRENCY, async (id) => {
    const result = await softDeleteAuditLog(
      supabase,
      auth,
      id,
      snapshotsById?.[id]
    );
    return { id, result };
  });

  for (const { id, result } of results) {
    if (result.ok) {
      deletedIds.push(id);
    } else if (/already in trash/i.test(result.message)) {
      deletedIds.push(id);
    } else {
      failed.push({ id, message: result.message });
    }
  }

  return { deletedIds, failed, truncatedCount };
}

/** Build a label when snapshot is partial (UI optimistic delete). */
export function auditLogLabelFromRow(row: AuditLogRow | Record<string, unknown>): string {
  return auditLogLabel(row as Record<string, unknown>);
}