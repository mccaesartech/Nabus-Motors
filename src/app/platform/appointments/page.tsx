"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import type { NotificationFeedbackVariant } from "@/lib/notifications/notification-status";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type AppointmentVehicle = {
  year?: number;
  make?: string;
  model?: string;
  slug?: string;
};

type Appointment = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  appointment_type: string;
  preferred_date: string | null;
  preferred_time: string | null;
  branch: string | null;
  status: string;
  notes: string | null;
  source?: string | null;
  order_id?: string | null;
  inquiry_id?: string | null;
  created_at: string;
  vehicles: AppointmentVehicle | null;
};

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<NotificationFeedbackVariant>("success");
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/appointments");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setAppointments(json.appointments ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/admin/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json();
    if (json.notificationMessage) {
      setToast(json.notificationMessage);
      setToastVariant((json.notificationVariant as NotificationFeedbackVariant) ?? "success");
    } else {
      setToast(null);
    }
    load();
  }

  async function removeAppointment(appt: Appointment) {
    await fetch(`/api/admin/appointments?id=${encodeURIComponent(appt.id)}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading appointments…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Manage vehicle viewings, inspections, and test drive requests."
        breadcrumb="Appointments"
      />

      {toast && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            toastVariant === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text-secondary)]"
              : toastVariant === "neutral"
                ? "border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-secondary)]"
                : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          }`}
        >
          {toast}
        </div>
      )}

      <div className="platform-card overflow-hidden rounded-xl">
        <table className="platform-table w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Preferred</th>
              <th className="px-4 py-3 font-medium">Booked</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--platform-text-secondary)]">
                  No appointments yet.
                </td>
              </tr>
            ) : (
              appointments.map((appt) => {
                const vehicle = appt.vehicles;
                const vehicleLabel = vehicle
                  ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
                  : "—";
                return (
                  <tr key={appt.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{appt.name}</p>
                      <p className="text-xs text-[var(--platform-text-secondary)]">
                        {appt.email}
                        {appt.phone ? ` · ${appt.phone}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {appt.appointment_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-xs">{vehicleLabel}</td>
                    <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                      {appt.preferred_date ?? "—"}
                      {appt.preferred_time ? ` · ${appt.preferred_time}` : ""}
                      {appt.branch ? ` · ${appt.branch}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                      <PlatformDateTime value={appt.created_at} className="text-xs" />
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-[var(--platform-text-secondary)]">
                      {(appt.source ?? "website").replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="platform-select text-xs"
                        value={appt.status}
                        onChange={(e) => void updateStatus(appt.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="platform-btn-ghost text-[var(--platform-error)]"
                        onClick={() => setDeleteTarget(appt)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete appointment?"
        description={
          deleteTarget
            ? `Permanently delete the appointment for ${deleteTarget.name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await removeAppointment(deleteTarget);
        }}
      />
    </div>
  );
}
