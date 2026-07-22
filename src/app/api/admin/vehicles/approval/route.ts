import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { friendlyAdminDbError } from "@/lib/admin/api-errors";
import { revalidatePublicSite } from "@/lib/admin/revalidate";
import { VEHICLE_APPROVAL_STATUSES } from "@/lib/admin/vehicle-approval";
import {
  canReviewVehicleApproval,
  hasPendingEdits,
  mergeVehicleWithPending,
  type VehiclePendingChanges,
} from "@/lib/admin/vehicle-pending-changes";
import { logPlatformActivity } from "@/lib/platform/activity";
import { clearVehiclePendingNotifications } from "@/lib/platform/vehicle-approval-notifications";
import type { DbVehicle } from "@/lib/platform/types";
import { vehicleWriteWithOptionalFallback } from "@/lib/admin/vehicle-columns";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { resolveRequestedSoldStatus } from "@/lib/vehicles/stock-automation";

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_approve");
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

  const body = (await req.json()) as {
    id?: string;
    action?: string;
    note?: string;
  };

  const id = body.id?.trim();
  const action = body.action?.trim();
  const note = body.note?.trim() || null;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing vehicle id" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject" && action !== "dismiss") {
    return NextResponse.json(
      { ok: false, message: 'Action must be "approve", "reject", or "dismiss".' },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("vehicles")
    .select("id, slug, year, make, model, approval_status, pending_changes")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(fetchError.message) },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 404 });
  }

  if (!canReviewVehicleApproval(existing.approval_status)) {
    return NextResponse.json(
      { ok: false, message: "Only pending or rejected vehicles can be reviewed." },
      { status: 400 }
    );
  }

  const isEditPending = hasPendingEdits(existing.pending_changes);
  const reviewedAt = new Date().toISOString();

  let updatePayload: Record<string, unknown>;

  if (action === "approve") {
    updatePayload = {
      approval_status: "approved",
      approval_note: note,
      reviewed_by: auth.auth.name,
      reviewed_at: reviewedAt,
      pending_changes: null,
    };

    if (isEditPending) {
      const pending = { ...(existing.pending_changes as VehiclePendingChanges) };
      if (pending.status === "sold") {
        const resolved = await resolveRequestedSoldStatus(supabase, {
          id,
          slug: existing.slug,
          make: String(pending.make ?? existing.make),
          model: String(pending.model ?? existing.model),
          year: Number(pending.year ?? existing.year),
        });
        pending.status = resolved;
        if (resolved === "pre_order") {
          await logPlatformActivity(auth.auth, "vehicle_auto_pre_order", existing.slug, {
            id,
            make: String(pending.make ?? existing.make),
            model: String(pending.model ?? existing.model),
            year: Number(pending.year ?? existing.year),
            source: "approval_status_change",
          });
        }
      }
      Object.assign(updatePayload, pending);
    }
  } else if (action === "dismiss") {
    if (!isEditPending || existing.approval_status !== "rejected") {
      return NextResponse.json(
        { ok: false, message: "Only rejected edit proposals can be dismissed." },
        { status: 400 }
      );
    }

    updatePayload = {
      approval_status: "approved",
      approval_note: null,
      reviewed_by: null,
      reviewed_at: null,
      pending_changes: null,
    };
  } else if (isEditPending) {
    updatePayload = {
      approval_status: "rejected",
      approval_note: note,
      reviewed_by: auth.auth.name,
      reviewed_at: reviewedAt,
      pending_changes: existing.pending_changes,
    };
  } else {
    updatePayload = {
      approval_status: "rejected",
      approval_note: note,
      reviewed_by: auth.auth.name,
      reviewed_at: reviewedAt,
      pending_changes: null,
    };
  }

  const approvalStatus = String(updatePayload.approval_status);
  if (!VEHICLE_APPROVAL_STATUSES.includes(approvalStatus as (typeof VEHICLE_APPROVAL_STATUSES)[number])) {
    return NextResponse.json({ ok: false, message: "Invalid approval status." }, { status: 400 });
  }

  if (updatePayload.available_locally === true) {
    updatePayload.shipment_available = false;
  } else if (updatePayload.shipment_available === true) {
    updatePayload.available_locally = false;
  }

  const previousSlug = existing.slug;

  const { result, warning } = await vehicleWriteWithOptionalFallback(
    async (selectColumns, payload) =>
      supabase.from("vehicles").update(payload).eq("id", id).select(selectColumns).maybeSingle(),
    updatePayload
  );
  const { data, error } = result;

  if (error) {
    return NextResponse.json(
      { ok: false, message: friendlyAdminDbError(error.message) },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ ok: false, message: "Vehicle could not be updated." }, { status: 500 });
  }

  const vehicle = data as DbVehicle;

  await clearVehiclePendingNotifications(supabase, id);

  if (action === "approve" || (action === "dismiss" && isEditPending)) {
    revalidatePublicSite(vehicle.slug);
    if (vehicle.slug !== previousSlug) {
      revalidatePublicSite(previousSlug);
    }
  }

  const titleVehicle = mergeVehicleWithPending(
    existing as Record<string, unknown>,
    isEditPending ? (existing.pending_changes as VehiclePendingChanges) : null
  );
  const title = `${titleVehicle.year} ${titleVehicle.make} ${titleVehicle.model}`;
  const activityType =
    action === "approve"
      ? "vehicle_approved"
      : action === "dismiss"
        ? "vehicle_approved"
        : "vehicle_rejected";
  await logPlatformActivity(auth.auth, activityType, vehicle.slug, {
    id: vehicle.id,
    note,
    vehicle_title: title,
    edit_rejection: action === "reject" && isEditPending,
    edit_dismissed: action === "dismiss",
  });

  return NextResponse.json({ ok: true, vehicle, warning });
}
