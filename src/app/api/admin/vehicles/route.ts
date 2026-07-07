import { NextRequest, NextResponse } from "next/server";
import { canManageTrash, requirePermission } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { friendlyAdminDbError } from "@/lib/admin/api-errors";
import { revalidatePublicSite } from "@/lib/admin/revalidate";
import {
  defaultApprovalStatusForCreate,
  isPubliclyListed,
  managerCanDeleteVehicle,
  managerNeedsApproval,
} from "@/lib/admin/vehicle-approval";
import {
  hasPendingEdits,
  mergeVehicleWithPending,
  type VehiclePendingChanges,
} from "@/lib/admin/vehicle-pending-changes";
import {
  buildVehicleSlug,
  imagesFromGallery,
  VEHICLE_STATUSES,
  type VehicleInput,
} from "@/lib/admin/vehicle-fields";
import { rowFromInput, validateVehicleInput } from "@/lib/admin/vehicle-mapper";
import { sanitizeGallery, primaryAndAdditionalToGallery } from "@/lib/data/vehicle-images";
import { notifyVehiclePendingApproval } from "@/lib/platform/vehicle-approval-notifications";
import { notDeletedFilter, softDeleteEntity } from "@/lib/platform/trash";
import type { VehicleGalleryData } from "@/lib/types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  applySoldStatusTransition,
  resolveRequestedSoldStatus,
} from "@/lib/vehicles/stock-automation";
import { notifyVehicleLocallyAvailable } from "@/lib/vehicle-interest/server";

const EDITABLE_FIELDS = [
  "make",
  "model",
  "year",
  "trim",
  "price",
  "mileage",
  "fuel_type",
  "transmission",
  "condition",
  "body_type",
  "location",
  "engine_size",
  "color",
  "vin",
  "description",
  "featured",
  "status",
  "images",
  "gallery",
  "primary_image_url",
  "additional_images",
  "trust_badges",
  "inspection_summary",
  "country_of_origin",
  "financing_available",
  "shipment_available",
  "customs_clearing_available",
  "warranty_notes",
  "walkaround_video_url",
  "available_locally",
] as const;

function pickUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (updates.year !== undefined) updates.year = Number(updates.year);
  if (updates.price !== undefined) updates.price = Number(updates.price);
  if (updates.mileage !== undefined) updates.mileage = Number(updates.mileage);
  if (updates.trim === "") updates.trim = null;
  if (updates.engine_size === "") updates.engine_size = null;
  if (updates.color === "") updates.color = null;
  if (updates.vin === "") updates.vin = null;
  if (updates.images !== undefined) {
    updates.images = Array.isArray(updates.images)
      ? updates.images.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  if (updates.additional_images !== undefined) {
    updates.additional_images = Array.isArray(updates.additional_images)
      ? updates.additional_images.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  if (updates.primary_image_url !== undefined) {
    const primary = String(updates.primary_image_url).trim();
    updates.primary_image_url = primary || null;
  }
  if (
    updates.primary_image_url !== undefined ||
    updates.additional_images !== undefined
  ) {
    const primary =
      updates.primary_image_url !== undefined
        ? String(updates.primary_image_url ?? "").trim()
        : undefined;
    const additional = updates.additional_images as string[] | undefined;
    if (primary !== undefined || additional !== undefined) {
      const gallery = primaryAndAdditionalToGallery(
        primary ?? "",
        additional ?? []
      );
      updates.gallery = gallery;
      updates.images = imagesFromGallery(gallery);
      if (primary !== undefined) {
        updates.primary_image_url = primary || null;
      }
      if (additional !== undefined) {
        updates.additional_images = additional;
      }
    }
  } else if (updates.gallery !== undefined) {
    const gallery = sanitizeGallery(updates.gallery as VehicleGalleryData);
    updates.gallery = gallery;
    updates.images = imagesFromGallery(gallery);
    const primary = gallery.exterior[0] ?? null;
    updates.primary_image_url = primary;
    updates.additional_images = [
      ...gallery.exterior.slice(1),
      ...gallery.interior,
      ...gallery.engine,
      ...gallery.other,
    ];
  } else if (updates.images !== undefined && !updates.gallery) {
    updates.gallery = sanitizeGallery({
      exterior: updates.images as string[],
      interior: [],
      engine: [],
      other: [],
    });
  }
  if (updates.available_locally !== undefined) {
    updates.available_locally = Boolean(updates.available_locally);
  }
  return updates;
}

function validatePatchUpdates(updates: Record<string, unknown>): string | null {
  if (updates.status !== undefined) {
    const status = String(updates.status);
    if (!VEHICLE_STATUSES.includes(status as (typeof VEHICLE_STATUSES)[number])) {
      return `Invalid status "${status}". Use available, pre_order, reserved, or sold.`;
    }
  }
  if (updates.price !== undefined) {
    const price = Number(updates.price);
    if (!Number.isFinite(price) || price < 0) {
      return "Price must be zero or greater.";
    }
  }
  if (updates.mileage !== undefined) {
    const mileage = Number(updates.mileage);
    if (!Number.isFinite(mileage) || mileage < 0) {
      return "Mileage must be zero or greater.";
    }
  }
  if (updates.make !== undefined && !String(updates.make).trim()) {
    return "Make is required.";
  }
  if (updates.model !== undefined && !String(updates.model).trim()) {
    return "Model is required.";
  }
  if (updates.location !== undefined && !String(updates.location).trim()) {
    return "Location is required.";
  }
  return null;
}

function isMissingGalleryColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("gallery") ||
      lower.includes("primary_image_url") ||
      lower.includes("additional_images")) &&
    lower.includes("schema cache")
  );
}

function stripOptionalVehicleImageColumns<T extends Record<string, unknown>>(row: T): T {
  const {
    gallery: _gallery,
    primary_image_url: _primary,
    additional_images: _additional,
    ...rest
  } = row;
  return rest as T;
}

export async function GET() {
  const auth = await requirePermission("inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars.",
      vehicles: [],
    });
  }

  const { data, error } = await notDeletedFilter(supabase.from("vehicles").select("*")).order(
    "created_at",
    { ascending: false }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(error.message) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, configured: true, vehicles: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase not configured" },
      { status: 503 }
    );
  }

  const body = (await req.json()) as Partial<VehicleInput>;
  const validated = validateVehicleInput(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, message: validated.message }, { status: 400 });
  }

  const slug = buildVehicleSlug(validated.data);
  const row = rowFromInput(validated.data, slug);
  const approvalStatus = defaultApprovalStatusForCreate(auth.auth.role);
  row.approval_status = approvalStatus;
  if (managerNeedsApproval(auth.auth.role) && auth.auth.type === "user") {
    row.submitted_by = auth.auth.userId ?? null;
  }

  let insertResult = await supabase.from("vehicles").insert(row).select().maybeSingle();

  if (insertResult.error && isMissingGalleryColumnError(insertResult.error.message)) {
    insertResult = await supabase
      .from("vehicles")
      .insert(stripOptionalVehicleImageColumns(row))
      .select()
      .maybeSingle();
  }

  const { data, error } = insertResult;

  if (error) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(error.message) },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, message: "Vehicle could not be created." },
      { status: 500 }
    );
  }

  if (approvalStatus === "approved") {
    revalidatePublicSite(data.slug);
    await logPlatformActivity(auth.auth, "vehicle_created", data.slug, { id: data.id });
  } else {
    await notifyVehiclePendingApproval(supabase, {
      id: data.id,
      year: data.year,
      make: data.make,
      model: data.model,
      submittedByName: auth.auth.name,
    });
    await logPlatformActivity(auth.auth, "vehicle_submitted", data.slug, {
      id: data.id,
      approval_status: approvalStatus,
    });
  }

  return NextResponse.json({
    ok: true,
    vehicle: data,
    pendingApproval: approvalStatus === "pending_approval",
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase not configured" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { id, ...rest } = body as { id: string } & Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing vehicle id" }, { status: 400 });
  }

  const updates = pickUpdates(rest);
  const requestedStatus =
    updates.status !== undefined ? String(updates.status) : undefined;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, message: "No fields to update" }, { status: 400 });
  }

  if (updates.year !== undefined) {
    const year = Number(updates.year);
    if (!Number.isFinite(year) || year < 1990 || year > 2030) {
      return NextResponse.json({ ok: false, message: "Invalid year" }, { status: 400 });
    }
  }

  const validationError = validatePatchUpdates(updates);
  if (validationError) {
    return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("vehicles")
    .select(
      "id, slug, approval_status, pending_changes, year, make, model, status, available_locally, local_availability_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(existingError.message) },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
  }

  const wasAvailableLocally = Boolean(existing.available_locally);
  const turningOnLocally =
    updates.available_locally === true && !wasAvailableLocally;
  if (turningOnLocally) {
    updates.local_availability_at = new Date().toISOString();
  }

  const stashPendingEdits =
    managerNeedsApproval(auth.auth.role) &&
    (existing.approval_status === "approved" ||
      existing.approval_status === "rejected" ||
      hasPendingEdits(existing.pending_changes));

  if (stashPendingEdits) {
    const priorPending = hasPendingEdits(existing.pending_changes)
      ? (existing.pending_changes as VehiclePendingChanges)
      : {};
    const pendingChanges: VehiclePendingChanges = { ...priorPending, ...updates };
    const pendingMeta = {
      approval_status: "pending_approval" as const,
      pending_changes: pendingChanges,
      reviewed_by: null,
      reviewed_at: null,
      approval_note: null,
      submitted_by: auth.auth.type === "user" ? (auth.auth.userId ?? null) : null,
    };

    let result = await supabase
      .from("vehicles")
      .update(pendingMeta)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (
      result.error &&
      isMissingGalleryColumnError(result.error.message) &&
      (pendingChanges.gallery !== undefined ||
        pendingChanges.primary_image_url !== undefined ||
        pendingChanges.additional_images !== undefined)
    ) {
      result = await supabase
        .from("vehicles")
        .update({
          ...pendingMeta,
          pending_changes: stripOptionalVehicleImageColumns(pendingChanges),
        })
        .eq("id", id)
        .select()
        .maybeSingle();
    }

    const { data, error } = result;

    if (error) {
      return NextResponse.json(
        { ok: false, message: friendlyAdminDbError(error.message) },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, message: "Vehicle not found or update was blocked." },
        { status: 404 }
      );
    }

    const becamePending =
      existing.approval_status === "approved" || existing.approval_status === "rejected";
    const proposed = mergeVehicleWithPending(data, data.pending_changes);

    if (isPubliclyListed(data.approval_status, data.pending_changes)) {
      revalidatePublicSite(data.slug);
    }

    if (becamePending) {
      await notifyVehiclePendingApproval(supabase, {
        id: data.id,
        year: Number(proposed.year),
        make: String(proposed.make),
        model: String(proposed.model),
        submittedByName: auth.auth.name,
      });
      await logPlatformActivity(auth.auth, "vehicle_submitted", data.slug, {
        id: data.id,
        approval_status: data.approval_status,
        resubmission: true,
      });
    } else {
      await logPlatformActivity(auth.auth, "vehicle_updated", data.slug, { id: data.id });
    }

    return NextResponse.json({
      ok: true,
      vehicle: data,
      pendingApproval: true,
    });
  }

  if (
    !managerNeedsApproval(auth.auth.role) &&
    existing.approval_status === "rejected"
  ) {
    updates.approval_status = "approved";
    updates.pending_changes = null;
    updates.reviewed_by = null;
    updates.reviewed_at = null;
    updates.approval_note = null;
  }

  if (
    managerNeedsApproval(auth.auth.role) &&
    existing.approval_status === "rejected"
  ) {
    updates.approval_status = "pending_approval";
    updates.reviewed_by = null;
    updates.reviewed_at = null;
    updates.approval_note = null;
    updates.pending_changes = null;
    if (auth.auth.type === "user") {
      updates.submitted_by = auth.auth.userId ?? null;
    }
  }

  if (
    managerNeedsApproval(auth.auth.role) &&
    existing.approval_status === "pending_approval" &&
    !hasPendingEdits(existing.pending_changes)
  ) {
    if (auth.auth.type === "user") {
      updates.submitted_by = auth.auth.userId ?? null;
    }
  }

  if (updates.status === "sold") {
    const make = String(updates.make ?? existing.make);
    const model = String(updates.model ?? existing.model);
    const year = Number(updates.year ?? existing.year);
    const resolved = await resolveRequestedSoldStatus(supabase, {
      id,
      slug: existing.slug,
      make,
      model,
      year,
    });
    updates.status = resolved;
  }

  let warning: string | undefined;
  let autoPreOrder = false;
  let patchPayload = updates;

  let result = await supabase
    .from("vehicles")
    .update(patchPayload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (
    result.error &&
    isMissingGalleryColumnError(result.error.message) &&
    (updates.gallery !== undefined ||
      updates.primary_image_url !== undefined ||
      updates.additional_images !== undefined)
  ) {
    patchPayload = stripOptionalVehicleImageColumns(updates);
    warning =
      "Saved without gallery images — run supabase/migrations/060_vehicle_gallery_images.sql in Supabase SQL Editor to enable vehicle galleries.";
    result = await supabase
      .from("vehicles")
      .update(patchPayload)
      .eq("id", id)
      .select()
      .maybeSingle();
  }

  const { data, error } = result;

  if (error) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(error.message) },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Vehicle not found or update was blocked. Check the listing still exists and SUPABASE_SERVICE_ROLE_KEY is set to the service role key.",
      },
      { status: 404 }
    );
  }

  if (requestedStatus === "sold" && updates.status === "pre_order") {
    autoPreOrder = true;
    await logPlatformActivity(auth.auth, "vehicle_auto_pre_order", data.slug, {
      id: data.id,
      make: data.make,
      model: data.model,
      year: data.year,
      source: "admin_status_change",
    });
  }

  const becamePending =
    managerNeedsApproval(auth.auth.role) &&
    existing.approval_status === "rejected" &&
    data.approval_status === "pending_approval";

  if (isPubliclyListed(data.approval_status, data.pending_changes)) {
    revalidatePublicSite(data.slug);
  }

  if (becamePending) {
    await notifyVehiclePendingApproval(supabase, {
      id: data.id,
      year: data.year,
      make: data.make,
      model: data.model,
      submittedByName: auth.auth.name,
    });
    await logPlatformActivity(auth.auth, "vehicle_submitted", data.slug, {
      id: data.id,
      approval_status: data.approval_status,
      resubmission: true,
    });
  } else {
    await logPlatformActivity(auth.auth, "vehicle_updated", data.slug, { id: data.id });
  }

  let availabilityNotifications: { notified: number; skipped: number } | undefined;
  if (turningOnLocally && data.local_availability_at) {
    try {
      availabilityNotifications = await notifyVehicleLocallyAvailable(supabase, {
        id: data.id,
        slug: data.slug,
        make: data.make,
        model: data.model,
        year: data.year,
        local_availability_at: data.local_availability_at,
      });
    } catch (err) {
      console.error("[vehicles] local availability notify failed:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    vehicle: data,
    warning,
    autoPreOrder,
    pendingApproval: data.approval_status === "pending_approval",
    availabilityNotifications,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase not configured" },
      { status: 503 }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("vehicles")
    .select("id, approval_status")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(existingError.message) },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
  }

  if (
    !canManageTrash(auth.auth) &&
    !managerCanDeleteVehicle(auth.auth.role, existing.approval_status)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Managers can only remove vehicles that are pending approval or rejected.",
      },
      { status: 403 }
    );
  }

  const result = await softDeleteEntity(supabase, auth.auth, "vehicle", id);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(result.message) },
      { status: result.status ?? 500 }
    );
  }

  revalidatePublicSite();
  await logPlatformActivity(auth.auth, "vehicle_deleted", id);
  return NextResponse.json({ ok: true });
}
