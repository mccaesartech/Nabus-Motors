import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { revalidatePublicSite } from "@/lib/admin/revalidate";
import { logPlatformActivity } from "@/lib/platform/activity";
import {
  INQUIRY_TRASH_TYPES,
  TRASH_ENTITY_LABELS,
  type PlatformTrashRow,
  type TrashEntityType,
} from "@/lib/platform/trash-types";

export {
  INQUIRY_TRASH_TYPES,
  TRASH_ENTITY_LABELS,
  TRASH_ENTITY_TYPES,
  type PlatformTrashRow,
  type TrashEntityType,
} from "@/lib/platform/trash-types";

const ENTITY_TABLE: Record<TrashEntityType, string | null> = {
  expense: "expenses",
  sale: "sales",
  order: "parts_orders",
  vehicle: "vehicles",
  customer: null,
  platform_user: "platform_users",
  lead_contact: "contact_inquiries",
  lead_finance: "finance_applications",
  lead_appraisal: "appraisal_requests",
  lead_vehicle: "vehicle_inquiries",
  preorder: "preorder_inquiries",
  support_ticket: "customer_conversations",
  admin_notification: "admin_notifications",
};

export type TrashListFilters = {
  entityType?: TrashEntityType | "all";
  deletedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type TrashSummary = {
  total: number;
  byType: Partial<Record<TrashEntityType, number>>;
  totalSalesValue: number;
  totalOrdersValue: number;
  totalVehicleValue: number;
};

export type RestoreTrashOptions = {
  vehicleStatus?: "available" | "pre_order" | "sold" | "reserved";
  /** When true, caller is responsible for revalidation (e.g. batch ops). */
  skipRevalidate?: boolean;
};

export type PermanentDeleteTrashOptions = {
  skipRevalidate?: boolean;
};

function actorFields(auth: PlatformAuthContext) {
  return {
    deleted_by_user_id: auth.type === "user" ? auth.userId ?? null : null,
    deleted_by_name: auth.name,
    deleted_by_email: auth.email,
  };
}

export function buildEntityLabel(
  entityType: TrashEntityType,
  row: Record<string, unknown>
): string {
  switch (entityType) {
    case "expense":
      return String(row.description ?? "Expense");
    case "sale":
      return `${row.customer_name ?? "Sale"} (${row.status ?? "—"})`;
    case "order":
      return `${row.name ?? row.email ?? "Order"} — ${row.status ?? "—"}`;
    case "vehicle": {
      const year = row.year ?? "";
      const make = row.make ?? "";
      const model = row.model ?? "";
      const title = `${year} ${make} ${model}`.trim();
      return title || String(row.slug ?? "Vehicle");
    }
    case "customer": {
      const first = row.first_name ?? "";
      const last = row.last_name ?? "";
      const name = `${first} ${last}`.trim();
      return name || String(row.email ?? "Customer");
    }
    case "platform_user": {
      const name = String(row.name ?? "").trim();
      const email = String(row.email ?? "").trim();
      if (name && email) return `${name} (${email})`;
      return name || email || TRASH_ENTITY_LABELS.platform_user;
    }
    case "lead_contact":
    case "lead_finance":
    case "lead_appraisal":
    case "lead_vehicle":
    case "preorder":
      return String(row.name ?? row.email ?? TRASH_ENTITY_LABELS[entityType]);
    case "support_ticket": {
      const subject = String(row.subject ?? "").trim();
      const customer =
        String(row.customer_name ?? "").trim() ||
        String(row.customer_email ?? "").trim();
      if (subject && customer) return `${subject} — ${customer}`;
      return subject || customer || TRASH_ENTITY_LABELS.support_ticket;
    }
    case "admin_notification": {
      const title = String(row.title ?? "").trim();
      if (title) return title;
      const message = String(row.message ?? "").trim();
      return message ? message.slice(0, 80) : TRASH_ENTITY_LABELS.admin_notification;
    }
    default:
      return TRASH_ENTITY_LABELS[entityType];
  }
}

async function fetchEntityRow(
  supabase: SupabaseClient,
  entityType: TrashEntityType,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const table = ENTITY_TABLE[entityType];
  if (!table) return null;

  const { data, error } = await supabase.from(table).select("*").eq("id", entityId).maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

async function markEntityDeleted(
  supabase: SupabaseClient,
  entityType: TrashEntityType,
  entityId: string,
  auth: PlatformAuthContext,
  now: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const table = ENTITY_TABLE[entityType];
  if (!table) return { ok: true };

  const { error } = await supabase
    .from(table)
    .update({
      deleted_at: now,
      deleted_by_user_id: auth.type === "user" ? auth.userId ?? null : null,
    })
    .eq("id", entityId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

async function clearEntityDeleted(
  supabase: SupabaseClient,
  entityType: TrashEntityType,
  entityId: string
) {
  const table = ENTITY_TABLE[entityType];
  if (!table) return;

  await supabase
    .from(table)
    .update({ deleted_at: null, deleted_by_user_id: null })
    .eq("id", entityId);
}

async function hardDeleteEntity(
  supabase: SupabaseClient,
  entityType: TrashEntityType,
  entityId: string
) {
  const table = ENTITY_TABLE[entityType];
  if (!table) return;

  await supabase.from(table).delete().eq("id", entityId);
}

async function restoreCustomer(
  supabase: SupabaseClient,
  entityId: string,
  snapshot: Record<string, unknown>
) {
  const profile = snapshot.profile as Record<string, unknown> | undefined;
  const email = String(snapshot.email ?? profile?.email ?? "").toLowerCase();

  if (profile?.id) {
    await supabase
      .from("profiles")
      .update({
        deleted_at: null,
        deleted_by_user_id: null,
        account_status: "active",
        first_name: profile.first_name ?? null,
        last_name: profile.last_name ?? null,
        phone: profile.phone ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    try {
      await supabase.auth.admin.updateUserById(String(profile.id), {
        ban_duration: "none",
        user_metadata: { account_deleted: false },
      });
    } catch {
      // Profile may exist without auth user.
    }
  }

  if (email) {
    await supabase.from("deleted_customer_emails").delete().eq("email", email);
  } else if (entityId.startsWith("email:")) {
    await supabase.from("deleted_customer_emails").delete().eq("email", entityId.slice(6));
  }
}

export async function recordTrashEntry(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  entityType: TrashEntityType,
  entityId: string,
  entityLabel: string,
  snapshot: Record<string, unknown>
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("platform_trash")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      snapshot,
      ...actorFields(auth),
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  await logPlatformActivity(auth, "item_deleted", entityLabel, {
    entityType,
    entityId,
    trashId: data.id,
  });

  return { ok: true, id: data.id as string };
}

export async function softDeleteEntity(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  entityType: TrashEntityType,
  entityId: string
): Promise<{ ok: true; trashId: string } | { ok: false; message: string; status?: number }> {
  const row = await fetchEntityRow(supabase, entityType, entityId);
  if (!row) {
    return { ok: false, message: "Record not found.", status: 404 };
  }

  if (row.deleted_at) {
    return { ok: false, message: "Record is already in trash.", status: 400 };
  }

  const now = new Date().toISOString();
  const entityLabel = buildEntityLabel(entityType, row);
  const snapshot = { ...row };
  if (entityType === "platform_user") {
    delete snapshot.password_hash;
  }

  const marked = await markEntityDeleted(supabase, entityType, entityId, auth, now);
  if (!marked.ok) {
    return { ok: false, message: marked.message, status: 500 };
  }

  const trash = await recordTrashEntry(
    supabase,
    auth,
    entityType,
    entityId,
    entityLabel,
    snapshot
  );

  if (!trash.ok) {
    return trash;
  }

  return { ok: true, trashId: trash.id };
}

const BATCH_CONCURRENCY = 6;
const MAX_BATCH_IDS = 100;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export function normalizeBatchIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_BATCH_IDS) break;
  }
  return ids;
}

export type SoftDeleteBatchResult = {
  deletedIds: string[];
  failed: Array<{ id: string; message: string }>;
};

/**
 * Soft-delete many entities of one type. Revalidates the public site once when
 * any vehicle/sale/preorder is moved to trash.
 */
export async function softDeleteEntities(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  entityType: TrashEntityType,
  entityIds: string[]
): Promise<SoftDeleteBatchResult> {
  const ids = normalizeBatchIds(entityIds);
  const failed: SoftDeleteBatchResult["failed"] = [];
  const deletedIds: string[] = [];

  if (ids.length === 0) {
    return { deletedIds, failed };
  }

  const results = await mapPool(ids, BATCH_CONCURRENCY, async (entityId) => {
    const result = await softDeleteEntity(supabase, auth, entityType, entityId);
    return { entityId, result };
  });

  for (const { entityId, result } of results) {
    if (result.ok) deletedIds.push(entityId);
    else failed.push({ id: entityId, message: result.message });
  }

  if (
    deletedIds.length > 0 &&
    (entityType === "vehicle" || entityType === "sale" || entityType === "preorder")
  ) {
    revalidatePublicSite();
  }

  return { deletedIds, failed };
}

export type TrashBatchResult = {
  succeededIds: string[];
  failed: Array<{ id: string; message: string }>;
};

/**
 * Permanently delete many trash entries. Revalidates once when needed.
 */
export async function permanentlyDeleteTrashEntries(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  trashIds: string[],
  options: { skipRevalidate?: boolean } = {}
): Promise<TrashBatchResult> {
  const ids = normalizeBatchIds(trashIds);
  const failed: TrashBatchResult["failed"] = [];
  const succeededIds: string[] = [];
  let needsRevalidate = false;

  if (ids.length === 0) {
    return { succeededIds, failed };
  }

  const results = await mapPool(ids, BATCH_CONCURRENCY, async (trashId) => {
    const result = await permanentlyDeleteTrashEntry(supabase, auth, trashId, {
      skipRevalidate: true,
    });
    return { trashId, result };
  });

  for (const { trashId, result } of results) {
    if (result.ok) {
      succeededIds.push(trashId);
      if (result.needsRevalidate) needsRevalidate = true;
    } else {
      failed.push({ id: trashId, message: result.message });
    }
  }

  if (needsRevalidate && !options.skipRevalidate) {
    revalidatePublicSite();
  }

  return { succeededIds, failed };
}

/**
 * Restore many trash entries. Revalidates once when needed.
 */
export async function restoreTrashEntries(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  trashIds: string[],
  options: RestoreTrashOptions & { skipRevalidate?: boolean } = {}
): Promise<TrashBatchResult> {
  const ids = normalizeBatchIds(trashIds);
  const failed: TrashBatchResult["failed"] = [];
  const succeededIds: string[] = [];
  let needsRevalidate = false;
  const { skipRevalidate, ...restoreOptions } = options;

  if (ids.length === 0) {
    return { succeededIds, failed };
  }

  const results = await mapPool(ids, BATCH_CONCURRENCY, async (trashId) => {
    const result = await restoreTrashEntry(supabase, auth, trashId, {
      ...restoreOptions,
      skipRevalidate: true,
    });
    return { trashId, result };
  });

  for (const { trashId, result } of results) {
    if (result.ok) {
      succeededIds.push(trashId);
      if (result.needsRevalidate) needsRevalidate = true;
    } else {
      failed.push({ id: trashId, message: result.message });
    }
  }

  if (needsRevalidate && !skipRevalidate) {
    revalidatePublicSite();
  }

  return { succeededIds, failed };
}

export async function countActiveTrash(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("platform_trash")
    .select("id", { count: "exact", head: true })
    .is("restored_at", null)
    .is("permanently_deleted_at", null);

  if (error) {
    console.error("[countActiveTrash]", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function listTrashEntries(
  supabase: SupabaseClient,
  filters: TrashListFilters = {}
): Promise<{ items: PlatformTrashRow[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("platform_trash")
    .select("*", { count: "exact" })
    .is("restored_at", null)
    .is("permanently_deleted_at", null)
    .order("deleted_at", { ascending: false });

  if (filters.entityType && filters.entityType !== "all") {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters.deletedBy?.trim()) {
    query = query.or(
      `deleted_by_email.ilike.%${filters.deletedBy.trim()}%,deleted_by_name.ilike.%${filters.deletedBy.trim()}%`
    );
  }
  if (filters.dateFrom) {
    query = query.gte("deleted_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("deleted_at", `${filters.dateTo}T23:59:59.999Z`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("[listTrashEntries]", error.message);
    return { items: [], total: 0 };
  }

  return { items: (data ?? []) as PlatformTrashRow[], total: count ?? 0 };
}

function moneyFromSnapshot(snapshot: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(snapshot[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export async function summarizeActiveTrash(supabase: SupabaseClient): Promise<TrashSummary> {
  const { data, error } = await supabase
    .from("platform_trash")
    .select("entity_type, snapshot")
    .is("restored_at", null)
    .is("permanently_deleted_at", null);

  if (error) {
    console.error("[summarizeActiveTrash]", error.message);
    return {
      total: 0,
      byType: {},
      totalSalesValue: 0,
      totalOrdersValue: 0,
      totalVehicleValue: 0,
    };
  }

  const byType: Partial<Record<TrashEntityType, number>> = {};
  let totalSalesValue = 0;
  let totalOrdersValue = 0;
  let totalVehicleValue = 0;

  for (const row of data ?? []) {
    const entityType = row.entity_type as TrashEntityType;
    byType[entityType] = (byType[entityType] ?? 0) + 1;

    const snapshot = (row.snapshot ?? {}) as Record<string, unknown>;
    if (entityType === "sale") {
      totalSalesValue += moneyFromSnapshot(snapshot, ["sale_price", "price", "total"]);
    } else if (entityType === "order") {
      totalOrdersValue += moneyFromSnapshot(snapshot, ["total", "order_total", "amount"]);
    } else if (entityType === "vehicle") {
      totalVehicleValue += moneyFromSnapshot(snapshot, ["price"]);
    }
  }

  return {
    total: data?.length ?? 0,
    byType,
    totalSalesValue,
    totalOrdersValue,
    totalVehicleValue,
  };
}

export async function restoreTrashEntry(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  trashId: string,
  options: RestoreTrashOptions = {}
): Promise<
  | { ok: true; needsRevalidate: boolean }
  | { ok: false; message: string; status?: number }
> {
  const { data: entry, error } = await supabase
    .from("platform_trash")
    .select("*")
    .eq("id", trashId)
    .maybeSingle();

  if (error || !entry) {
    return { ok: false, message: "Trash item not found.", status: 404 };
  }

  if (entry.restored_at || entry.permanently_deleted_at) {
    return { ok: false, message: "This item is no longer in the recycle bin.", status: 400 };
  }

  const entityType = entry.entity_type as TrashEntityType;
  const entityId = String(entry.entity_id);
  const snapshot = (entry.snapshot ?? {}) as Record<string, unknown>;

  if (entityType === "customer") {
    await restoreCustomer(supabase, entityId, snapshot);
  } else {
    await clearEntityDeleted(supabase, entityType, entityId);

    if (entityType === "platform_user") {
      const priorStatus =
        typeof snapshot.status === "string" && snapshot.status.trim()
          ? snapshot.status
          : "active";
      await supabase
        .from("platform_users")
        .update({ status: priorStatus })
        .eq("id", entityId);
    }

    if (entityType === "vehicle" && options.vehicleStatus) {
      await supabase
        .from("vehicles")
        .update({ status: options.vehicleStatus })
        .eq("id", entityId);
    }
  }

  const now = new Date().toISOString();
  await supabase.from("platform_trash").update({ restored_at: now }).eq("id", trashId);

  const needsRevalidate =
    entityType === "vehicle" || entityType === "sale" || entityType === "preorder";

  if (needsRevalidate && !options.skipRevalidate) {
    revalidatePublicSite();
  }

  await logPlatformActivity(auth, "item_restored", entry.entity_label, {
    entityType,
    entityId,
    trashId,
    vehicleStatus: options.vehicleStatus,
  });

  return { ok: true, needsRevalidate };
}

export async function permanentlyDeleteTrashEntry(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  trashId: string,
  options: PermanentDeleteTrashOptions = {}
): Promise<
  | { ok: true; needsRevalidate: boolean }
  | { ok: false; message: string; status?: number }
> {
  const { data: entry, error } = await supabase
    .from("platform_trash")
    .select("*")
    .eq("id", trashId)
    .maybeSingle();

  if (error || !entry) {
    return { ok: false, message: "Trash item not found.", status: 404 };
  }

  if (entry.restored_at || entry.permanently_deleted_at) {
    return { ok: false, message: "This item is no longer in the recycle bin.", status: 400 };
  }

  const entityType = entry.entity_type as TrashEntityType;
  const entityId = String(entry.entity_id);

  if (entityType === "customer") {
    const snapshot = (entry.snapshot ?? {}) as Record<string, unknown>;
    const profile = snapshot.profile as Record<string, unknown> | undefined;
    if (profile?.id) {
      await supabase.from("profiles").delete().eq("id", profile.id);
    }
  } else {
    await hardDeleteEntity(supabase, entityType, entityId);
  }

  const needsRevalidate =
    entityType === "vehicle" || entityType === "sale" || entityType === "preorder";

  if (needsRevalidate && !options.skipRevalidate) {
    revalidatePublicSite();
  }

  const now = new Date().toISOString();
  await supabase.from("platform_trash").update({ permanently_deleted_at: now }).eq("id", trashId);

  await logPlatformActivity(auth, "item_permanently_deleted", entry.entity_label, {
    entityType,
    entityId,
    trashId,
  });

  return { ok: true, needsRevalidate };
}

export { notDeletedFilter } from "@/lib/platform/trash-types";
