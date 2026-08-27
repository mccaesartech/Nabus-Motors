import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { revalidatePublicSite } from "@/lib/admin/revalidate";
import { logPlatformActivity } from "@/lib/platform/activity";
import {
  INQUIRY_TRASH_TYPES,
  TRASH_ENTITY_LABELS,
  buildTrashSearchOrFilter,
  sanitizeTrashSearchTerm,
  type PlatformTrashRow,
  type TrashEntityType,
} from "@/lib/platform/trash-types";

export {
  INQUIRY_TRASH_TYPES,
  TRASH_ENTITY_LABELS,
  TRASH_ENTITY_TYPES,
  buildTrashSearchOrFilter,
  sanitizeTrashSearchTerm,
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
  document: "documents",
  part: "parts",
  part_category: "parts_categories",
  shipment: "shipment_tracking",
  freight_quote: "freight_quote_requests",
  appointment: "vehicle_appointments",
  sent_email: "notification_log",
  audit_log: "audit_logs",
};

export type TrashListFilters = {
  entityType?: TrashEntityType | "all";
  deletedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Search entity label, id, and common snapshot fields (make/model/VIN/name/…). */
  q?: string;
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
    case "document":
      return String(row.title ?? TRASH_ENTITY_LABELS.document);
    case "part":
      return String(row.name ?? row.sku ?? TRASH_ENTITY_LABELS.part);
    case "part_category":
      return String(row.name ?? TRASH_ENTITY_LABELS.part_category);
    case "shipment": {
      const tracking = String(row.tracking_number ?? "").trim();
      const destination = String(row.destination ?? "").trim();
      if (tracking && destination) return `${tracking} — ${destination}`;
      return tracking || destination || TRASH_ENTITY_LABELS.shipment;
    }
    case "freight_quote": {
      const ref = String(row.reference_code ?? "").trim();
      const name = String(row.name ?? row.email ?? "").trim();
      if (ref && name) return `${ref} — ${name}`;
      return ref || name || TRASH_ENTITY_LABELS.freight_quote;
    }
    case "appointment": {
      const name = String(row.name ?? row.email ?? "").trim();
      const date = String(row.preferred_date ?? "").trim();
      if (name && date) return `${name} — ${date}`;
      return name || date || TRASH_ENTITY_LABELS.appointment;
    }
    case "sent_email": {
      const recipient = String(row.recipient ?? "").trim();
      const template = String(row.template ?? "").trim();
      if (recipient && template) return `${template} → ${recipient}`;
      return recipient || template || TRASH_ENTITY_LABELS.sent_email;
    }
    case "audit_log": {
      const action = String(row.action ?? "Audit event");
      const actor = String(row.actor_name ?? row.actor_role ?? "").trim();
      const target = String(row.target_name ?? row.target_id ?? "").trim();
      if (actor && target) return `${action} — ${actor} → ${target}`;
      if (actor) return `${action} — ${actor}`;
      if (target) return `${action} — ${target}`;
      return action;
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

  const { data, error } = await supabase
    .from(table)
    .update({
      deleted_at: now,
      deleted_by_user_id: auth.type === "user" ? auth.userId ?? null : null,
    })
    .eq("id", entityId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.id) {
    return { ok: false, message: "Soft-delete did not update the record." };
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
): Promise<{ ok: true } | { ok: false; message: string }> {
  const table = ENTITY_TABLE[entityType];
  if (!table) return { ok: true };

  const { error } = await supabase.from(table).delete().eq("id", entityId);
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

function customerEmailFromTrashEntry(
  entityId: string,
  snapshot: Record<string, unknown>
): string {
  const profile = snapshot.profile as Record<string, unknown> | undefined;
  const fromSnapshot =
    typeof snapshot.email === "string" && snapshot.email.trim()
      ? snapshot.email.trim()
      : typeof profile?.email === "string" && profile.email.trim()
        ? profile.email.trim()
        : entityId.startsWith("email:")
          ? entityId.slice(6)
          : "";
  return fromSnapshot.toLowerCase();
}

/** Remove customer soft-delete markers after permanent trash delete. */
async function purgeCustomerPermanentDeleteMarkers(
  supabase: SupabaseClient,
  entityId: string,
  snapshot: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const profile = snapshot.profile as Record<string, unknown> | undefined;
  if (profile?.id) {
    const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
    if (error) return { ok: false, message: error.message };
  } else if (!entityId.startsWith("email:")) {
    const { error } = await supabase.from("profiles").delete().eq("id", entityId);
    if (error) return { ok: false, message: error.message };
  }

  const email = customerEmailFromTrashEntry(entityId, snapshot);
  if (email) {
    const { error } = await supabase.from("deleted_customer_emails").delete().eq("email", email);
    if (error) return { ok: false, message: error.message };
  }
  return { ok: true };
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
): Promise<
  | { ok: true; trashId: string; publicSlug?: string }
  | { ok: false; message: string; status?: number }
> {
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
  const publicSlug =
    entityType === "vehicle" && typeof row.slug === "string" && row.slug.trim()
      ? row.slug.trim()
      : undefined;

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
    await clearEntityDeleted(supabase, entityType, entityId);
    return { ok: false, message: trash.message, status: 500 };
  }

  return { ok: true, trashId: trash.id, publicSlug };
}

export const BATCH_CONCURRENCY = 6;
const MAX_BATCH_IDS = 100;

export async function mapPool<T, R>(
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

export function normalizeBatchIds(raw: unknown, maxIds = MAX_BATCH_IDS): string[] {
  if (!Array.isArray(raw)) return [];
  const limit = Math.max(1, maxIds);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
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

  const publicSlugs: string[] = [];
  for (const { entityId, result } of results) {
    if (result.ok) {
      deletedIds.push(entityId);
      if (result.publicSlug) publicSlugs.push(result.publicSlug);
    } else failed.push({ id: entityId, message: result.message });
  }

  if (
    deletedIds.length > 0 &&
    (entityType === "vehicle" || entityType === "sale" || entityType === "preorder")
  ) {
    revalidatePublicSite(publicSlugs[0]);
    for (let i = 1; i < publicSlugs.length; i++) {
      revalidatePublicSite(publicSlugs[i]);
    }
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
    const deletedBy = sanitizeTrashSearchTerm(filters.deletedBy);
    if (deletedBy) {
      query = query.or(
        `deleted_by_email.ilike.%${deletedBy}%,deleted_by_name.ilike.%${deletedBy}%`
      );
    }
  }
  const searchOr = filters.q ? buildTrashSearchOrFilter(filters.q) : null;
  if (searchOr) {
    query = query.or(searchOr);
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
  } else if (entityType === "sent_email") {
    const { error: insertError } = await supabase.from("notification_log").insert({
      id: entityId,
      source_table: snapshot.source_table ?? null,
      source_id: snapshot.source_id ?? null,
      template: snapshot.template,
      channel: snapshot.channel ?? "email",
      status: snapshot.status,
      recipient: snapshot.recipient,
      detail: snapshot.detail ?? null,
      created_at: snapshot.created_at,
    });
    if (insertError) {
      return { ok: false, message: insertError.message, status: 500 };
    }
  } else if (entityType === "audit_log") {
    const { error: insertError } = await supabase.from("audit_logs").insert({
      id: entityId,
      timestamp: snapshot.timestamp,
      actor_user_id: snapshot.actor_user_id ?? null,
      actor_name: snapshot.actor_name ?? null,
      actor_role: snapshot.actor_role ?? null,
      action: snapshot.action,
      target_type: snapshot.target_type ?? null,
      target_id: snapshot.target_id ?? null,
      target_name: snapshot.target_name ?? null,
      ip_address: snapshot.ip_address ?? null,
      user_agent: snapshot.user_agent ?? null,
      browser: snapshot.browser ?? null,
      operating_system: snapshot.operating_system ?? null,
      request_id: snapshot.request_id ?? null,
      success: snapshot.success ?? true,
      error_message: snapshot.error_message ?? null,
      metadata: snapshot.metadata ?? {},
      country: snapshot.country ?? null,
      region: snapshot.region ?? null,
      city: snapshot.city ?? null,
    });
    if (insertError) {
      return { ok: false, message: insertError.message, status: 500 };
    }
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
    const slug =
      entityType === "vehicle" && typeof snapshot.slug === "string"
        ? snapshot.slug.trim()
        : undefined;
    revalidatePublicSite(slug || undefined);
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
    const purged = await purgeCustomerPermanentDeleteMarkers(supabase, entityId, snapshot);
    if (!purged.ok) {
      return { ok: false, message: purged.message, status: 500 };
    }
  } else if (entityType !== "audit_log") {
    // audit_log rows are hard-deleted when moved to trash; only stamp the tombstone here.
    const deleted = await hardDeleteEntity(supabase, entityType, entityId);
    if (!deleted.ok) {
      return { ok: false, message: deleted.message, status: 500 };
    }
  }

  // Hide forever any linked ephemeral delivery notification when a sent email
  // is permanently purged (soft-delete already removed notification_log).
  if (entityType === "sent_email") {
    const ephemeralId = `notification-log-${entityId}`;
    const { data: ephemeralTrash } = await supabase
      .from("platform_trash")
      .select("id")
      .eq("entity_type", "admin_notification")
      .eq("entity_id", ephemeralId)
      .is("restored_at", null)
      .is("permanently_deleted_at", null)
      .maybeSingle();
    if (ephemeralTrash?.id) {
      await supabase
        .from("platform_trash")
        .update({ permanently_deleted_at: new Date().toISOString() })
        .eq("id", ephemeralTrash.id);
    }
  }

  const needsRevalidate =
    entityType === "vehicle" || entityType === "sale" || entityType === "preorder";

  if (needsRevalidate && !options.skipRevalidate) {
    const snapshot = (entry.snapshot ?? {}) as Record<string, unknown>;
    const slug =
      entityType === "vehicle" && typeof snapshot.slug === "string"
        ? snapshot.slug.trim()
        : undefined;
    revalidatePublicSite(slug || undefined);
  }

  const now = new Date().toISOString();
  const { error: stampError } = await supabase
    .from("platform_trash")
    .update({ permanently_deleted_at: now })
    .eq("id", trashId);

  if (stampError) {
    return { ok: false, message: stampError.message, status: 500 };
  }

  await logPlatformActivity(auth, "item_permanently_deleted", entry.entity_label, {
    entityType,
    entityId,
    trashId,
  });

  return { ok: true, needsRevalidate };
}

export { notDeletedFilter } from "@/lib/platform/trash-types";
