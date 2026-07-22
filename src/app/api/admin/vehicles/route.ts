import { NextRequest, NextResponse } from "next/server";
import { canManageTrash, requirePermission } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { recordVehicleReceived, recordVehicleSold } from "@/lib/platform/inventory-movements/record";
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
  ADMIN_PATCH_EXISTING_SELECT,
  ADMIN_PATCH_EXISTING_SELECT_MINIMAL,
  adminVehicleSelectColumns,
  omitEmptyOptionalVehicleFields,
  vehicleWriteWithOptionalFallback,
} from "@/lib/admin/vehicle-columns";
import {
  buildVehicleSlug,
  imagesFromGallery,
  localShipmentConflict,
  normalizeWalkaroundVideoUrl,
  VEHICLE_STATUSES,
  type VehicleInput,
} from "@/lib/admin/vehicle-fields";
import { rowFromInput, validateVehicleInput } from "@/lib/admin/vehicle-mapper";
import {
  bodyHasSpecFormFields,
  buildVehicleSpecs,
  extractSpecFormFields,
} from "@/lib/admin/vehicle-specs";
import { sanitizeGallery, primaryAndAdditionalToGallery } from "@/lib/data/vehicle-images";
import { notifyVehiclePendingApproval } from "@/lib/platform/vehicle-approval-notifications";
import { notDeletedFilter, softDeleteEntity } from "@/lib/platform/trash";
import type { VehicleGalleryData } from "@/lib/types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { resolveRequestedSoldStatus } from "@/lib/vehicles/stock-automation";
import { notifyVehicleLocallyAvailable } from "@/lib/vehicle-interest/server";
import type { DbVehicle } from "@/lib/platform/types";

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
  "specs",
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
  if (bodyHasSpecFormFields(body)) {
    const existingSpecs = Array.isArray(body.specs)
      ? (body.specs as { label: string; value: string }[])
      : Array.isArray(updates.specs)
        ? (updates.specs as { label: string; value: string }[])
        : [];
    const fromExisting = extractSpecFormFields(existingSpecs);
    const seatingRaw = body.seating_capacity;
    let seating: number | null | undefined;
    if (seatingRaw === undefined) {
      seating = fromExisting.seating_capacity;
    } else if (seatingRaw === "" || seatingRaw === null) {
      seating = null;
    } else {
      seating = Number(seatingRaw);
    }
    updates.specs = buildVehicleSpecs({
      seating_capacity:
        seating != null && Number.isFinite(seating) && seating > 0 ? seating : null,
      drivetrain:
        body.drivetrain !== undefined ? String(body.drivetrain) : fromExisting.drivetrain,
      horsepower:
        body.horsepower !== undefined ? String(body.horsepower) : fromExisting.horsepower,
      range: body.range !== undefined ? String(body.range) : fromExisting.range,
      specs: existingSpecs,
    });
  }
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
  if (updates.financing_available !== undefined) {
    updates.financing_available = Boolean(updates.financing_available);
  }
  if (updates.shipment_available !== undefined) {
    updates.shipment_available = Boolean(updates.shipment_available);
  }
  if (updates.customs_clearing_available !== undefined) {
    updates.customs_clearing_available = Boolean(updates.customs_clearing_available);
  }
  if (updates.walkaround_video_url !== undefined) {
    updates.walkaround_video_url = normalizeWalkaroundVideoUrl(
      updates.walkaround_video_url == null ? "" : String(updates.walkaround_video_url)
    );
  }
  return omitEmptyOptionalVehicleFields(updates);
}

function validatePatchUpdates(
  updates: Record<string, unknown>,
  existing?: { available_locally?: boolean | null; shipment_available?: boolean | null }
): string | null {
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
  const availableLocally =
    updates.available_locally !== undefined
      ? Boolean(updates.available_locally)
      : Boolean(existing?.available_locally);
  const shipmentAvailable =
    updates.shipment_available !== undefined
      ? Boolean(updates.shipment_available)
      : Boolean(existing?.shipment_available);
  if (localShipmentConflict(availableLocally, shipmentAvailable)) {
    return "Locally available stock cannot also be marked for shipment. Turn off one of them.";
  }
  return null;
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

  let selectColumns = adminVehicleSelectColumns("full");
  let { data, error } = await notDeletedFilter(
    supabase.from("vehicles").select(selectColumns)
  ).order("created_at", { ascending: false });

  if (error) {
    selectColumns = adminVehicleSelectColumns("safe");
    const fallback = await notDeletedFilter(
      supabase.from("vehicles").select(selectColumns)
    ).order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

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

  const { result: insertResult, warning: insertWarning } =
    await vehicleWriteWithOptionalFallback(async (selectColumns, payload) => {
      return supabase.from("vehicles").insert(payload).select(selectColumns).maybeSingle();
    }, row);

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

  const vehicle = data as unknown as DbVehicle;

  if (approvalStatus === "approved") {
    revalidatePublicSite(vehicle.slug);
    await logPlatformActivity(auth.auth, "vehicle_created", vehicle.slug, { id: vehicle.id });
  } else {
    await notifyVehiclePendingApproval(supabase, {
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      submittedByName: auth.auth.name,
    });
    await logPlatformActivity(auth.auth, "vehicle_submitted", vehicle.slug, {
      id: vehicle.id,
      approval_status: approvalStatus,
    });
  }

  await recordVehicleReceived(
    supabase,
    {
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      price: vehicle.price,
      created_at: vehicle.created_at,
    },
    auth.auth
  );

  return NextResponse.json({
    ok: true,
    vehicle,
    warning: insertWarning,
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

  type ExistingVehicle = {
    id: string;
    slug: string;
    approval_status: string | null;
    pending_changes: unknown;
    year: number;
    make: string;
    model: string;
    status: string;
    available_locally?: boolean | null;
    local_availability_at?: string | null;
    shipment_available?: boolean | null;
  };

  let existing: ExistingVehicle | null = null;
  const existingQuery = await supabase
    .from("vehicles")
    .select(ADMIN_PATCH_EXISTING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!existingQuery.error && existingQuery.data) {
    existing = existingQuery.data;
  } else {
    const minimal = await supabase
      .from("vehicles")
      .select(ADMIN_PATCH_EXISTING_SELECT_MINIMAL)
      .eq("id", id)
      .maybeSingle();
    if (minimal.error) {
      return NextResponse.json(
        { ok: false, message: friendlyAdminDbError(minimal.error.message) },
        { status: 500 }
      );
    }
    if (!minimal.data) {
      return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
    }
    existing = {
      ...minimal.data,
      available_locally: false,
      local_availability_at: null,
      shipment_available: false,
    };
  }

  // Enforce DB exclusivity (migration 069): local stock cannot also be shipment inventory.
  if (updates.available_locally === true) {
    updates.shipment_available = false;
  } else if (updates.shipment_available === true) {
    updates.available_locally = false;
  }

  const validationError = validatePatchUpdates(updates, existing);
  if (validationError) {
    return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
  }

  const wasAvailableLocally = Boolean(existing.available_locally);
  const turningOnLocally =
    updates.available_locally === true && !wasAvailableLocally;
  const turningOffLocally =
    updates.available_locally === false && wasAvailableLocally;
  if (turningOnLocally) {
    updates.local_availability_at = new Date().toISOString();
  } else if (turningOffLocally) {
    updates.local_availability_at = null;
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

    const { result, warning: pendingWarning } = await vehicleWriteWithOptionalFallback(
      async (selectColumns, payload) =>
        supabase.from("vehicles").update(payload).eq("id", id).select(selectColumns).maybeSingle(),
      pendingMeta
    );

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

    const pendingVehicle = data as unknown as DbVehicle;
    const becamePending =
      existing.approval_status === "approved" || existing.approval_status === "rejected";
    const proposed = mergeVehicleWithPending(pendingVehicle, pendingVehicle.pending_changes);

    if (isPubliclyListed(pendingVehicle.approval_status, pendingVehicle.pending_changes)) {
      revalidatePublicSite(pendingVehicle.slug);
    }

    if (becamePending) {
      await notifyVehiclePendingApproval(supabase, {
        id: pendingVehicle.id,
        year: Number(proposed.year),
        make: String(proposed.make),
        model: String(proposed.model),
        submittedByName: auth.auth.name,
      });
      await logPlatformActivity(auth.auth, "vehicle_submitted", pendingVehicle.slug, {
        id: pendingVehicle.id,
        approval_status: pendingVehicle.approval_status,
        resubmission: true,
      });
    } else {
      await logPlatformActivity(auth.auth, "vehicle_updated", pendingVehicle.slug, {
        id: pendingVehicle.id,
      });
    }

    return NextResponse.json({
      ok: true,
      vehicle: pendingVehicle,
      warning: pendingWarning,
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

  const { result, warning: writeWarning } = await vehicleWriteWithOptionalFallback(
    async (selectColumns, payload) =>
      supabase.from("vehicles").update(payload).eq("id", id).select(selectColumns).maybeSingle(),
    updates
  );
  warning = writeWarning;

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

  const vehicle = data as unknown as DbVehicle;

  if (requestedStatus === "sold" && updates.status === "pre_order") {
    autoPreOrder = true;
    await logPlatformActivity(auth.auth, "vehicle_auto_pre_order", vehicle.slug, {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      source: "admin_status_change",
    });
  }

  const becamePending =
    managerNeedsApproval(auth.auth.role) &&
    existing.approval_status === "rejected" &&
    vehicle.approval_status === "pending_approval";

  if (isPubliclyListed(vehicle.approval_status, vehicle.pending_changes)) {
    revalidatePublicSite(vehicle.slug);
  }

  if (becamePending) {
    await notifyVehiclePendingApproval(supabase, {
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      submittedByName: auth.auth.name,
    });
    await logPlatformActivity(auth.auth, "vehicle_submitted", vehicle.slug, {
      id: vehicle.id,
      approval_status: vehicle.approval_status,
      resubmission: true,
    });
  } else {
    await logPlatformActivity(auth.auth, "vehicle_updated", vehicle.slug, { id: vehicle.id });
  }

  let availabilityNotifications: { notified: number; skipped: number } | undefined;
  if (turningOnLocally && vehicle.local_availability_at) {
    try {
      availabilityNotifications = await notifyVehicleLocallyAvailable(supabase, {
        id: vehicle.id,
        slug: vehicle.slug,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        local_availability_at: vehicle.local_availability_at,
      });
    } catch (err) {
      console.error("[vehicles] local availability notify failed:", err);
    }
  }

  const becameSold =
    requestedStatus === "sold" &&
    updates.status === "sold" &&
    existing.status !== "sold";
  if (becameSold) {
    await recordVehicleSold(
      supabase,
      {
        id: vehicle.id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        price: vehicle.price,
      },
      { auth: auth.auth, movementType: "vehicle_sold" }
    );
  }

  return NextResponse.json({
    ok: true,
    vehicle,
    warning,
    autoPreOrder,
    pendingApproval: vehicle.approval_status === "pending_approval",
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
