import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { AUDIT_ACTION_LABELS, isAuditAction } from "@/lib/audit/actions";
import { AUDIT_LOG_TABLE } from "@/lib/audit/write";
import type { AuditLogRow } from "@/lib/audit/types";
import {
  buildEntityLabel,
  normalizeBatchIds,
  recordTrashEntry,
} from "@/lib/platform/trash";

function auditLogLabel(row: Record<string, unknown>): string {
  const actionRaw = String(row.action ?? "Audit event");
  const action = isAuditAction(actionRaw)
    ? AUDIT_ACTION_LABELS[actionRaw]
    : actionRaw;
  const actor = String(row.actor_name ?? row.actor_role ?? "").trim();
  const target = String(row.target_name ?? row.target_id ?? "").trim();
  if (actor && target) return `${action} — ${actor} → ${target}`;
  if (actor) return `${action} — ${actor}`;
  if (target) return `${action} — ${target}`;
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
    .maybeSingle();

  return data?.id ? String(data.id) : null;
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
}> {
  const normalized = normalizeBatchIds(ids);
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];

  for (const id of normalized) {
    const result = await softDeleteAuditLog(
      supabase,
      auth,
      id,
      snapshotsById?.[id]
    );
    if (result.ok) deletedIds.push(id);
    else if (/already in trash/i.test(result.message)) deletedIds.push(id);
    else failed.push({ id, message: result.message });
  }

  return { deletedIds, failed };
}

/** Build a label when snapshot is partial (UI optimistic delete). */
export function auditLogLabelFromRow(row: AuditLogRow | Record<string, unknown>): string {
  return auditLogLabel(row as Record<string, unknown>);
}
