"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/platform/page-header";
import { CategoryBadges } from "@/components/admin/category-badges";
import { PlatformVehicleForm } from "@/components/platform/platform-vehicle-form";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import { extractSpecFormFields } from "@/lib/admin/vehicle-specs";
import { parseTrustBadges } from "@/lib/vehicles/trust-badges";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  adminErrorMessage,
  isAdminAuthError,
  parseAdminResponse,
  redirectToAdminLogin,
} from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import type { DbVehicle } from "@/lib/platform/types";
import { ApprovalStatusBadge } from "@/components/platform/status-badge";
import { usePlatformSession } from "@/components/platform/platform-shell";
import {
  hasPendingEdits,
  isRejectedEditPending,
  mergeVehicleWithPending,
} from "@/lib/admin/vehicle-pending-changes";

export default function EditVehiclePage() {
  const router = useRouter();
  const session = usePlatformSession();
  const isManager = session?.role === "manager";
  const params = useParams();
  const id = String(params.id ?? "");
  const [vehicle, setVehicle] = useState<DbVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interestStats, setInterestStats] = useState<{
    uniqueEmails: number;
    totalActivities: number;
    recentActivities: number;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/vehicles");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    const found = (json.vehicles as DbVehicle[] | undefined)?.find((v) => v.id === id);
    setVehicle(found ?? null);
    setLoading(false);

    if (found) {
      fetch(`/api/admin/vehicles/${id}/interest`, { credentials: "same-origin" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok && data.stats) setInterestStats(data.stats);
        })
        .catch(() => {
          // non-blocking
        });
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(data: VehicleInput) {
    setSaving(true);
    const res = await fetch("/api/admin/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id, ...data }),
    });
    const json = await parseAdminResponse(res);
    setSaving(false);
    if (isAdminAuthError(res)) {
      redirectToAdminLogin(router);
      throw new Error(adminErrorMessage(json, "Session expired. Please sign in again."));
    }
    if (!res.ok || !json.ok) {
      throw new Error(adminErrorMessage(json));
    }
    router.push(platformPath("inventory"));
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading vehicle…</p>;
  }

  if (!vehicle) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Vehicle not found"
          breadcrumb="Inventory"
          backFallbackHref={platformPath("inventory")}
          backLabel="Back to inventory"
        />
      </div>
    );
  }

  const isEditPending = hasPendingEdits(vehicle.pending_changes);
  const isRejectedEdit = isRejectedEditPending(vehicle.approval_status, vehicle.pending_changes);
  const formVehicle = isEditPending
    ? mergeVehicleWithPending(vehicle, vehicle.pending_changes)
    : vehicle;
  const specFields = extractSpecFormFields(formVehicle.specs ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Edit ${formVehicle.year} ${formVehicle.make} ${formVehicle.model}`}
        description={
          isRejectedEdit
            ? "These proposed edits were rejected. Update and save to resubmit, or re-approve from the inventory list."
            : isManager && vehicle.approval_status === "approved"
              ? "Saving changes will send proposed edits for owner approval. The live listing stays unchanged until approved."
              : isEditPending
                ? "This listing has proposed edits awaiting approval. Saving again will update the pending submission."
                : vehicle.approval_status === "rejected"
                  ? "This submission was rejected. Update and save to resubmit for approval."
                  : "Update listing details, pricing, and availability."
        }
        breadcrumb="Inventory"
        backFallbackHref={platformPath("inventory")}
        backLabel="Back to inventory"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
          Approval
        </span>
        <ApprovalStatusBadge status={vehicle.approval_status ?? "approved"} />
        {vehicle.approval_status === "rejected" && vehicle.approval_note && (
          <p className="text-sm text-[var(--platform-text-secondary)]">{vehicle.approval_note}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
          Categories
        </span>
        <CategoryBadges vehicle={vehicle} variant="platform" />
      </div>
      {interestStats && (
        <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3 text-sm text-[var(--platform-text)]">
          <p className="font-medium">Customer interest</p>
          <p className="mt-1 text-[var(--platform-text-secondary)]">
            {interestStats.uniqueEmails} unique contact
            {interestStats.uniqueEmails === 1 ? "" : "s"} · {interestStats.totalActivities}{" "}
            tracked activit{interestStats.totalActivities === 1 ? "y" : "ies"}
            {interestStats.recentActivities > 0
              ? ` · ${interestStats.recentActivities} in the last 30 days`
              : ""}
          </p>
        </div>
      )}
      <PlatformVehicleForm
        initial={{
          id: vehicle.id,
          slug: vehicle.slug,
          make: formVehicle.make,
          model: formVehicle.model,
          year: formVehicle.year,
          trim: formVehicle.trim ?? undefined,
          price: formVehicle.price,
          mileage: formVehicle.mileage,
          fuel_type: formVehicle.fuel_type,
          transmission: formVehicle.transmission,
          condition: formVehicle.condition,
          body_type: formVehicle.body_type,
          location: formVehicle.location,
          engine_size: formVehicle.engine_size ?? undefined,
          color: formVehicle.color ?? undefined,
          vin: formVehicle.vin ?? undefined,
          seating_capacity: specFields.seating_capacity,
          drivetrain: specFields.drivetrain ?? undefined,
          horsepower: specFields.horsepower ?? undefined,
          range: specFields.range ?? undefined,
          specs: formVehicle.specs ?? [],
          description: formVehicle.description ?? undefined,
          featured: formVehicle.featured,
          status: formVehicle.status,
          images: formVehicle.images,
          primary_image_url: formVehicle.primary_image_url ?? undefined,
          additional_images: formVehicle.additional_images ?? undefined,
          gallery: formVehicle.gallery,
          trust_badges: parseTrustBadges(formVehicle.trust_badges),
          inspection_summary: formVehicle.inspection_summary ?? undefined,
          warranty_notes: formVehicle.warranty_notes ?? undefined,
          walkaround_video_url: formVehicle.walkaround_video_url ?? undefined,
          country_of_origin: (formVehicle.country_of_origin ?? "") as VehicleInput["country_of_origin"],
          financing_available: formVehicle.financing_available ?? false,
          shipment_available: formVehicle.shipment_available ?? false,
          customs_clearing_available: formVehicle.customs_clearing_available ?? false,
          available_locally: formVehicle.available_locally ?? false,
        }}
        onSave={save}
        onCancel={() => router.push(platformPath("inventory"))}
        saving={saving}
      />
    </div>
  );
}
