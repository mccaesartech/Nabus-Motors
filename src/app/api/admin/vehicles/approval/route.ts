import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { dbFailure } from "@/lib/errors/api";
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
import {
  resolveUnitSoldTransition,
} from "@/lib/vehicles/stock-automation";
import { maybeNotifyVehicleStockAction, refreshFleetLowStockAlert } from "@/lib/platform/vehicle-stock-notifications";
import { recordVehicleSold } from "@/lib/platform/inventory-movements/record";
import { normalizeStockQuantity } from "@/lib/admin/vehicle-fields";
import { listingUnitCount } from "@/lib/vehicles/low-stock";
import {
  notifyPriceDropSubscribers,
  notifyVehicleLocallyAvailable,
} from "@/lib/vehicle-interest/server";

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
    publishConfirmed?: boolean;
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

  if (action === "approve" && body.publishConfirmed !== true) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Confirm the full vehicle details and photos before publishing to the public website.",
        code: "PUBLISH_CONFIRMATION_REQUIRED",
      },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("vehicles")
    .select(
      "id, slug, year, make, model, price, stock_quantity, approval_status, pending_changes, available_locally, local_availability_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return dbFailure(fetchError, {
      module: "api.admin.vehicles.approval.POST.load",
      message: "We could not load that vehicle for review. Try again.",
      request: req,
      actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
      context: { vehicleId: id },
    });
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
  let approvedSoldTransition: {
    autoPreOrder: boolean;
    availableSiblings: number;
    remainingInGroup: number;
    unitDecremented: boolean;
    stock_quantity: number;
    make: string;
    model: string;
    year: number;
  } | null = null;

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
        const make = String(pending.make ?? existing.make);
        const model = String(pending.model ?? existing.model);
        const year = Number(pending.year ?? existing.year);
        const qtyBasis =
          pending.stock_quantity !== undefined
            ? normalizeStockQuantity(pending.stock_quantity)
            : listingUnitCount({ stock_quantity: existing.stock_quantity });
        const transition = await resolveUnitSoldTransition(supabase, {
          id,
          slug: existing.slug,
          make,
          model,
          year,
          stock_quantity: qtyBasis,
        });
        pending.status = transition.status;
        pending.stock_quantity = transition.stock_quantity;
        approvedSoldTransition = {
          autoPreOrder: transition.autoPreOrder,
          availableSiblings: transition.availableSiblings,
          remainingInGroup: transition.remainingInGroup,
          unitDecremented: transition.unitDecremented,
          stock_quantity: transition.stock_quantity,
          make,
          model,
          year,
        };
        if (transition.autoPreOrder) {
          await logPlatformActivity(auth.auth, "vehicle_auto_pre_order", existing.slug, {
            id,
            make,
            model,
            year,
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
    return dbFailure(error, {
      module: "api.admin.vehicles.approval.POST",
      message: "The approval decision could not be saved. Try again.",
      request: req,
      actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
      context: { vehicleId: id },
    });
  }

  if (!data) {
    return NextResponse.json({ ok: false, message: "Vehicle could not be updated." }, { status: 500 });
  }

  const vehicle = data as DbVehicle;

  await clearVehiclePendingNotifications(supabase, id);

  if (action === "approve" && approvedSoldTransition) {
    try {
      await maybeNotifyVehicleStockAction(supabase, {
        id: vehicle.id,
        slug: vehicle.slug,
        year: approvedSoldTransition.year,
        make: approvedSoldTransition.make,
        model: approvedSoldTransition.model,
        availableSiblings: approvedSoldTransition.remainingInGroup,
        autoPreOrder: approvedSoldTransition.autoPreOrder,
        source: "sold",
        sourceDetail: "approval_status_change",
      });
      await refreshFleetLowStockAlert(supabase);
    } catch (err) {
      console.error("[vehicles/approval] stock action notify failed:", err);
    }

    await recordVehicleSold(
      supabase,
      {
        id: vehicle.id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        price: vehicle.price,
      },
      {
        auth: auth.auth,
        movementType: "vehicle_sold",
        referenceId: `${vehicle.id}:sold:approval:${Date.now()}`,
      }
    );
  }

  if (action === "approve" && isEditPending) {
    const pending = existing.pending_changes as VehiclePendingChanges;
    const previousPrice = Number(existing.price);
    const newPrice = Number(
      pending.price !== undefined ? pending.price : vehicle.price
    );
    if (
      pending.price !== undefined &&
      Number.isFinite(previousPrice) &&
      Number.isFinite(newPrice) &&
      newPrice < previousPrice
    ) {
      try {
        await notifyPriceDropSubscribers(supabase, {
          id: vehicle.id,
          slug: vehicle.slug,
          make: String(vehicle.make),
          model: String(vehicle.model),
          year: Number(vehicle.year),
          previousPrice,
          newPrice,
        });
      } catch (err) {
        console.error("[vehicles/approval] price-drop notify failed:", err);
      }
    }

    const wasLocal = Boolean(existing.available_locally);
    const nowLocal = Boolean(vehicle.available_locally);
    if (!wasLocal && nowLocal && vehicle.local_availability_at) {
      try {
        await notifyVehicleLocallyAvailable(supabase, {
          id: vehicle.id,
          slug: vehicle.slug,
          make: String(vehicle.make),
          model: String(vehicle.model),
          year: Number(vehicle.year),
          local_availability_at: String(vehicle.local_availability_at),
        });
      } catch (err) {
        console.error("[vehicles/approval] local availability notify failed:", err);
      }
    }
  }

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
