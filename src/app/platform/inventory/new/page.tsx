"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformVehicleForm } from "@/components/platform/platform-vehicle-form";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import { platformPath } from "@/lib/platform/paths";
import {
  adminErrorMessage,
  isAdminAuthError,
  parseAdminResponse,
  redirectToAdminLogin,
} from "@/lib/admin/client";
import { usePlatformSession } from "@/components/platform/platform-shell";

export default function NewVehiclePage() {
  const router = useRouter();
  const session = usePlatformSession();
  const isManager = session?.role === "manager";
  const [saving, setSaving] = useState(false);

  async function save(data: VehicleInput) {
    setSaving(true);
    const res = await fetch("/api/admin/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data),
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Add vehicle"
        description={
          isManager
            ? "Submit a new listing for owner or super-admin approval. It will not appear on the public site until approved."
            : "List a new unit in inventory. Changes sync to the public website within a minute."
        }
        breadcrumb="Inventory"
        backFallbackHref={platformPath("inventory")}
        backLabel="Back to inventory"
      />
      <PlatformVehicleForm
        onSave={save}
        onCancel={() => router.push(platformPath("inventory"))}
        saving={saving}
      />
    </div>
  );
}
