"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { StatusBadge } from "@/components/platform/status-badge";
import { CustomerVisibleNoteField } from "@/components/platform/customer-visible-note-field";
import { VisualShipmentTimeline } from "@/components/shared/visual-shipment-timeline";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import { canUseCustomerNoteAi, type PlatformRole } from "@/lib/platform/permissions";
import { ShipmentStatusSelect } from "@/components/platform/shipment-timeline-guide";
import {
  generateTrackingNumber,
  SHIPMENT_REFERENCE_TYPES,
  SHIPMENT_STATUSES,
  shipmentStatusLabel,
  type ShipmentReferenceType,
  type ShipmentTimelineEventRow,
  type ShipmentTrackingRow,
  type ShipmentWithEvents,
} from "@/lib/platform/shipment";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import {
  applyPresetToForm,
  presetContextFromShipment,
  QUICK_SHIPMENT_EVENT_PRESETS,
} from "@/lib/platform/shipment-event-presets";
import type { NotificationFeedbackVariant } from "@/lib/notifications/notification-status";

type ShipmentManagerProps = {
  title: string;
  description: string;
  breadcrumb: string;
  referenceType?: ShipmentReferenceType;
  showCreate?: boolean;
};

export function ShipmentManager({
  title,
  description,
  breadcrumb,
  referenceType,
  showCreate = true,
}: ShipmentManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shipments, setShipments] = useState<ShipmentTrackingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShipmentWithEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<NotificationFeedbackVariant>("success");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tracking_number: generateTrackingNumber(),
    customer_name: "",
    customer_email: "",
    origin_country: "",
    destination: "Ghana",
    vessel_name: "",
    container_number: "",
    status: "pending",
    estimated_arrival: "",
    notes: "",
    reference_id: "",
  });
  const [eventForm, setEventForm] = useState({ title: "", description: "" });
  const [showCustomEventForm, setShowCustomEventForm] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [canUseAi, setCanUseAi] = useState(false);

  function resetEventForm() {
    setEventForm({ title: "", description: "" });
    setShowCustomEventForm(false);
  }

  function applyNotificationToast(json: {
    notificationMessage?: string;
    notificationVariant?: NotificationFeedbackVariant;
  }, fallback: string) {
    if (json.notificationMessage) {
      setToast(json.notificationMessage);
      setToastVariant(json.notificationVariant ?? "success");
    } else {
      setToast(fallback);
      setToastVariant("success");
    }
  }

  async function addPresetEvent(presetId: string) {
    if (!detail || !selectedId || saving) return;
    const preset = QUICK_SHIPMENT_EVENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const filled = applyPresetToForm(preset, presetContextFromShipment(detail));
    const payload: Record<string, unknown> = {
      add_event: {
        title: filled.title,
        description: filled.description || null,
        location: filled.location || null,
        is_customer_visible: true,
        milestone: true,
      },
    };
    if (filled.suggestedStatus && filled.suggestedStatus !== detail.status) {
      payload.status = filled.suggestedStatus;
    }

    setSaving(true);
    const res = await fetch("/api/admin/freight/shipments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, ...payload }),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      applyNotificationToast(json, `${preset.label} update added.`);
      await loadList();
      await loadDetail(selectedId);
    }
  }

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (referenceType) params.set("reference_type", referenceType);
    const res = await fetch(`/api/admin/freight/shipments?${params}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setShipments(json.shipments ?? []);
    setLoading(false);
  }, [referenceType, router]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/freight/shipments?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const json = await res.json();
      setDetail(json.shipment ?? null);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => res.json())
      .then((json) => {
        const role = json.user?.role as PlatformRole | undefined;
        setCanUseAi(Boolean(role && canUseCustomerNoteAi(role)));
      })
      .catch(() => setCanUseAi(false));
  }, []);

  useEffect(() => {
    const shipmentId = searchParams.get("shipment") ?? searchParams.get("id");
    if (shipmentId) {
      setSelectedId(shipmentId);
    }
    if (searchParams.get("create") === "1") {
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    setNotesDraft(detail?.notes ?? "");
  }, [detail?.id, detail?.notes]);

  async function createShipment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/freight/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_type: referenceType ?? "freight",
        reference_id: form.reference_id || null,
        tracking_number: form.tracking_number,
        customer_name: form.customer_name || null,
        customer_email: form.customer_email || null,
        origin_country: form.origin_country || null,
        destination: form.destination || "Ghana",
        vessel_name: form.vessel_name || null,
        container_number: form.container_number || null,
        status: form.status,
        estimated_arrival: form.estimated_arrival || null,
        notes: form.notes || null,
        initial_event: {
          title: "Shipment created",
          description: "Tracking record opened by admin.",
          is_customer_visible: true,
        },
      }),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      applyNotificationToast(json, "Shipment created.");
      setShowForm(false);
      setForm((f) => ({ ...f, tracking_number: generateTrackingNumber() }));
      await loadList();
      if (json.shipment?.id) setSelectedId(json.shipment.id);
    }
  }

  async function updateShipment(updates: Record<string, unknown>): Promise<boolean> {
    if (!selectedId) return false;
    setSaving(true);
    const res = await fetch("/api/admin/freight/shipments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, ...updates }),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      const isCustomerSend =
        updates.notes !== undefined ||
        updates.add_event !== undefined ||
        updates.status !== undefined;
      applyNotificationToast(
        json,
        isCustomerSend ? "Message sent to customer." : "Shipment updated."
      );
      await loadList();
      await loadDetail(selectedId);
      return true;
    }
    return false;
  }

  async function sendCustomerNotes() {
    if (!selectedId || notesDraft === (detail?.notes ?? "")) return;
    const ok = await updateShipment({ notes: notesDraft || null });
    if (!ok) {
      throw new Error("Send failed");
    }
  }

  async function addCustomEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !eventForm.title.trim()) return;
    const ok = await updateShipment({
      add_event: {
        title: eventForm.title.trim(),
        description: eventForm.description || null,
        location: null,
        is_customer_visible: true,
      },
    });
    if (ok) {
      resetEventForm();
    }
  }

  async function deleteEvent(event: ShipmentTimelineEventRow) {
    if (!selectedId) return;
    await updateShipment({ delete_event_id: event.id });
  }

  async function deleteShipment(id: string) {
    if (!confirm("Delete this shipment and all timeline events?")) return;
    await fetch(`/api/admin/freight/shipments?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (selectedId === id) setSelectedId(null);
    await loadList();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading shipments…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumb={breadcrumb}
        actions={
          showCreate ? (
            <button
              type="button"
              className="platform-btn-primary inline-flex items-center gap-2"
              onClick={() => setShowForm((v) => !v)}
            >
              <Plus className="size-4" />
              New shipment
            </button>
          ) : undefined
        }
      />

      {toast && (
        <div
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

      {showForm && (
        <form onSubmit={createShipment} className="platform-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold">Create shipment</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Tracking number</span>
              <input
                className="platform-input w-full"
                value={form.tracking_number}
                onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Customer name</span>
              <input
                className="platform-input w-full"
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Customer email</span>
              <input
                type="email"
                className="platform-input w-full"
                value={form.customer_email}
                onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Origin country</span>
              <input
                className="platform-input w-full"
                value={form.origin_country}
                onChange={(e) => setForm((f) => ({ ...f, origin_country: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Status</span>
              <select
                className="platform-select w-full"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {SHIPMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {shipmentStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            {referenceType === "preorder" && (
              <label className="block space-y-1.5">
                <span className="text-xs text-[var(--platform-text-secondary)]">Pre-order ID</span>
                <input
                  className="platform-input w-full font-mono text-xs"
                  value={form.reference_id}
                  onChange={(e) => setForm((f) => ({ ...f, reference_id: e.target.value }))}
                  placeholder="UUID from pre-order inquiry"
                />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="platform-btn-primary">
              {saving ? "Creating…" : "Create shipment"}
            </button>
            <button type="button" className="platform-btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="platform-table w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[var(--platform-text-secondary)]">
                  <th className="px-4 py-3 font-medium">Tracking #</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--platform-text-secondary)]">
                      No shipments yet.
                    </td>
                  </tr>
                ) : (
                  shipments.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selectedId === row.id ? "bg-[rgba(37,99,235,0.06)]" : undefined
                      }
                    >
                      <td className="px-4 py-3 font-mono text-xs">{row.tracking_number}</td>
                      <td className="px-4 py-3">
                        <p>{row.customer_name ?? "—"}</p>
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          {row.customer_email ?? ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={row.created_at} className="text-xs" />
                        <p className="mt-0.5 text-[10px]">
                          Updated <PlatformDateTime value={row.updated_at} className="text-[10px]" />
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs"
                            onClick={() => setSelectedId(row.id)}
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs text-[var(--platform-error)]"
                            onClick={() => void deleteShipment(row.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="platform-card space-y-4 rounded-xl p-5">
          {!detail ? (
            <p className="text-sm text-[var(--platform-text-secondary)]">
              Select a shipment to update status, notes, and timeline events.
            </p>
          ) : (
            <>
              <div>
                <p className="font-mono text-sm font-semibold">{detail.tracking_number}</p>
                <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                  {detail.reference_type}
                  {detail.reference_id && (
                    <>
                      {" · "}
                      <Link
                        href={platformPath(`leads/preorder/${detail.reference_id}`)}
                        className="text-[var(--platform-accent)] hover:underline"
                      >
                        View linked record
                      </Link>
                    </>
                  )}
                </p>
              </div>

              <VisualShipmentTimeline
                status={detail.status}
                trackingId={detail.tracking_number}
                referenceId={detail.reference_id}
                expectedArrival={detail.estimated_arrival}
                theme="platform"
              />

              <div className="space-y-2 border-t border-[var(--platform-border)] pt-4">
                <p className="text-xs text-[var(--platform-text-secondary)]">
                  Pick a milestone to add a customer update — status updates automatically.
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ShipmentStatusSelect
                    inline
                    value={detail.status}
                    onChange={(status) => void updateShipment({ status })}
                    disabled={saving}
                  />
                  {QUICK_SHIPMENT_EVENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="rounded-full border border-[var(--platform-border)] bg-[var(--platform-surface)] px-2.5 py-1 text-xs text-[var(--platform-text-secondary)] hover:border-[var(--platform-accent)] hover:text-[var(--platform-accent)] disabled:opacity-50"
                      onClick={() => void addPresetEvent(preset.id)}
                      disabled={saving}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {!showCustomEventForm ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--platform-accent)] hover:underline"
                    onClick={() => setShowCustomEventForm(true)}
                  >
                    Custom message
                  </button>
                ) : (
                  <form onSubmit={addCustomEvent} className="space-y-2 rounded-lg border border-[var(--platform-border)] p-3">
                    <input
                      className="platform-input w-full text-sm"
                      placeholder="Event title"
                      value={eventForm.title}
                      onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                      required
                      autoFocus
                    />
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]">
                        Add description (optional)
                      </summary>
                      <textarea
                        className="platform-input mt-2 w-full resize-y text-sm"
                        rows={2}
                        placeholder="Plain-language update for the customer timeline"
                        value={eventForm.description}
                        onChange={(e) =>
                          setEventForm((f) => ({ ...f, description: e.target.value }))
                        }
                      />
                    </details>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="platform-btn-primary text-xs">
                        {saving ? "Sending…" : "Send to customer"}
                      </button>
                      <button
                        type="button"
                        className="platform-btn-ghost text-xs"
                        onClick={resetEventForm}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <CustomerVisibleNoteField
                label="Customer-visible notes"
                value={notesDraft}
                onChange={setNotesDraft}
                savedValue={detail.notes ?? ""}
                onSend={sendCustomerNotes}
                sending={saving}
                rows={2}
                placeholder="e.g. Your vehicle has cleared customs and is ready for pickup at Tema Port."
                hint="General message shown on tracking — click Send to customer when ready."
                showAi={canUseAi}
                aiContext={{
                  fieldType: "shipment_notes",
                  status: shipmentStatusLabel(detail.status),
                  customerName: detail.customer_name ?? undefined,
                  trackingNumber: detail.tracking_number,
                  originCountry: detail.origin_country ?? undefined,
                  destination: detail.destination ?? undefined,
                  estimatedArrival: detail.estimated_arrival ?? undefined,
                  vesselName: detail.vessel_name ?? undefined,
                  containerNumber: detail.container_number ?? undefined,
                  timelineEvents: (detail.events ?? []).map((e) => ({
                    title: e.title,
                    description: e.description,
                    location: e.location,
                    event_at: e.event_at,
                  })),
                }}
              />

              <div className="border-t border-[var(--platform-border)] pt-4">
                <h3 className="text-sm font-semibold">Timeline</h3>
                <ul className="mt-3 space-y-3">
                  {(detail.events ?? []).map((event) => (
                    <li key={event.id} className="rounded-lg border border-[var(--platform-border)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{event.title}</p>
                          {event.description && (
                            <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                              {event.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                            <PlatformDateTime value={event.event_at} className="text-xs" />
                            {event.location ? ` · ${event.location}` : ""}
                            {!event.is_customer_visible && " · Hidden from customer"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="platform-btn-ghost text-[var(--platform-error)]"
                          onClick={() => void deleteEvent(event)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { SHIPMENT_REFERENCE_TYPES };
