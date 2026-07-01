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
  lead_contact: "contact_inquiries",
  lead_finance: "finance_applications",
  lead_appraisal: "appraisal_requests",
  lead_vehicle: "vehicle_inquiries",
  preorder: "preorder_inquiries",
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
    case "lead_contact":
    case "lead_finance":
    case "lead_appraisal":
    case "lead_vehicle":
    case "preorder":
      return String(row.name ?? row.email ?? TRASH_ENTITY_LABELS[entityType]);
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
) {
  const table = ENTITY_TABLE[entityType];
  if (!table) return;

  await supabase
    .from(table)
    .update({
      deleted_at: now,
      deleted_by_user_id: auth.type === "user" ? auth.userId ?? null : null,
    })
    .eq("id", entityId);
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

  await markEntityDeleted(supabase, entityType, entityId, auth, now);

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
): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
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

    if (entityType === "vehicle" && options.vehicleStatus) {
      await supabase
        .from("vehicles")
        .update({ status: options.vehicleStatus })
        .eq("id", entityId);
    }
  }

  const now = new Date().toISOString();
  await supabase.from("platform_trash").update({ restored_at: now }).eq("id", trashId);

  if (entityType === "vehicle" || entityType === "sale" || entityType === "preorder") {
    revalidatePublicSite();
  }

  await logPlatformActivity(auth, "item_restored", entry.entity_label, {
    entityType,
    entityId,
    trashId,
    vehicleStatus: options.vehicleStatus,
  });

  return { ok: true };
}

export async function permanentlyDeleteTrashEntry(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  trashId: string
): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
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

  if (entityType === "vehicle" || entityType === "sale" || entityType === "preorder") {
    revalidatePublicSite();
  }

  const now = new Date().toISOString();
  await supabase.from("platform_trash").update({ permanently_deleted_at: now }).eq("id", trashId);

  await logPlatformActivity(auth, "item_permanently_deleted", entry.entity_label, {
    entityType,
    entityId,
    trashId,
  });

  return { ok: true };
}

export { notDeletedFilter } from "@/lib/platform/trash-types";
