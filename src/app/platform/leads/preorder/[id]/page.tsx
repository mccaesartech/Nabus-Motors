"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ExternalLink, FileText, Mail, MessageSquare, Phone, RotateCcw, Trash2, User } from "lucide-react";
import { WhatsAppAssistAction } from "@/components/platform/whatsapp-assist-dialog";
import { customerProfileIdForOrder } from "@/lib/platform/order-profile";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformPrintButton, PrintableRecord } from "@/components/platform/printable-record";
import { buildAdminPreorderDocumentHtml } from "@/lib/platform/printable-documents";
import { seedCachedPreorder } from "@/lib/print/pdf-cache";
import { useMarkNotificationsOnVisit } from "@/hooks/use-mark-notifications-read";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PaymentStatusBadge, StatusBadge } from "@/components/platform/status-badge";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import {
  normalizeVehicle,
  type PreorderInquiryRow,
  vehicleImageFromRow,
  vehicleTitleFromRow,
} from "@/lib/platform/preorder";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { platformPath } from "@/lib/platform/paths";
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS } from "@/lib/platform/types";
import {
  CUSTOM_REQUEST_STATUS_OPTIONS,
  customRequestStatusLabel,
  formatBudgetRangeGhs,
  parseCustomRequestSpecs,
} from "@/lib/platform/custom-request";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { formatPlatformDateTime } from "@/lib/platform/datetime";
import {
  canDirectMutate,
  MUTATION_APPROVAL_REQUIRED_MESSAGE,
} from "@/lib/platform/mutation-approval";

type LinkedSale = {
  id: string;
  status: string;
  sale_price: number;
  created_at?: string;
};

function shippingHandlingLabel(value?: string | null) {
  if (value === "customer_arranged") return "Option A — Customer arranges shipping";
  if (value === "true_goshen") return "Option B — Nabus Motors handles freight & clearing";
  if (value === "consultation") return "Option C — Consultation requested";
  return "—";
}

export default function PreorderDetailPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const session = usePlatformSession();
  useMarkNotificationsOnVisit({ link: pathname });
  const canEditInventory = session?.permissions.inventory_edit ?? false;
  const canMutate = session ? canDirectMutate(session.role) : false;
  const { formatPrice } = usePlatformCurrency();
  const params = useParams();
  const id = String(params.id ?? "");
  const [inquiry, setInquiry] = useState<PreorderInquiryRow | null>(null);
  const [linkedSale, setLinkedSale] = useState<LinkedSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showRevert, setShowRevert] = useState(false);
  const [converting, setConverting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [matchedVehicleId, setMatchedVehicleId] = useState("");
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [actionToastError, setActionToastError] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/inquiries/preorder/${id}`);
    if (!res.ok) {
      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return;
      }
      setInquiry(null);
      setLinkedSale(null);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const row = json.inquiry as PreorderInquiryRow;
    seedCachedPreorder(row);
    setInquiry(row);
    setLinkedSale((json.linkedSale as LinkedSale | null) ?? null);
    setNotes(row.follow_up_notes ?? "");
    setMatchedVehicleId(row.matched_vehicle_id ?? "");
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateField(updates: {
    status?: string;
    source?: string;
    follow_up_notes?: string;
    payment_status?: string;
    matched_vehicle_id?: string | null;
  }) {
    if (!inquiry) return;
    if (!canMutate) {
      setActionToastError(true);
      setActionToast(MUTATION_APPROVAL_REQUIRED_MESSAGE);
      return;
    }
    setSaving(true);
    setActionToast(null);
    const res = await fetch("/api/admin/inquiries/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "preorder", id: inquiry.id, ...updates }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || json.ok === false) {
      setActionToastError(true);
      setActionToast(String(json.message ?? "Could not update pre-order."));
      return;
    }
    setActionToastError(false);
    if (updates.payment_status === "down_payment_paid") {
      setActionToast("25% payment marked received. Linked vehicle reserved in inventory when available.");
    } else {
      setActionToast("Pre-order updated.");
    }
    await load();
  }

  async function handleDelete() {
    if (!canMutate) {
      setActionToastError(true);
      setActionToast(MUTATION_APPROVAL_REQUIRED_MESSAGE);
      return;
    }
    const res = await fetch(`/api/admin/inquiries/preorder/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`${platformPath("leads")}?tab=preorder`);
      return;
    }
    const json = await res.json().catch(() => ({}));
    setActionToastError(true);
    setActionToast(String(json.message ?? "Could not delete pre-order."));
  }

  async function convertToSale() {
    if (!canMutate) {
      setActionToastError(true);
      setActionToast(MUTATION_APPROVAL_REQUIRED_MESSAGE);
      return;
    }
    setConverting(true);
    setActionToast(null);
    const res = await fetch("/api/admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preorder_inquiry_id: id }),
    });
    const json = await res.json().catch(() => ({}));
    setConverting(false);
    if (!res.ok || json.ok === false) {
      setActionToastError(true);
      setActionToast(String(json.message ?? "Could not convert to sale."));
      return;
    }
    if (json.sale?.id) {
      router.push(platformPath("sales"));
    } else {
      setActionToastError(false);
      setActionToast("Converted to sale.");
      await load();
    }
  }

  async function revertToPreorder() {
    if (!linkedSale) return;
    if (!canMutate) {
      setActionToastError(true);
      setActionToast(MUTATION_APPROVAL_REQUIRED_MESSAGE);
      return;
    }
    setReverting(true);
    setActionToast(null);
    const res = await fetch("/api/admin/sales", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: linkedSale.id, action: "revert" }),
    });
    const json = await res.json().catch(() => ({}));
    setReverting(false);
    if (!res.ok || json.ok === false) {
      setActionToastError(true);
      setActionToast(String(json.message ?? "Could not revert sale."));
      return;
    }
    setActionToastError(false);
    setActionToast("Sale reverted to pre-order.");
    await load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading pre-order…</p>;
  }

  if (!inquiry) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Pre-order not found"
          breadcrumb="Leads"
          backFallbackHref={`${platformPath("leads")}?tab=preorder`}
          backLabel="Back to leads"
        />
      </div>
    );
  }

  const vehicle = normalizeVehicle(inquiry.vehicle);
  const vehicleTitle = vehicleTitleFromRow(inquiry);
  const vehicleImage = vehicleImageFromRow(inquiry);
  const vehiclePrice = inquiry.vehicle_price_usd ?? vehicle?.price ?? 0;
  const downPayment = inquiry.down_payment_usd ?? 0;
  const vehicleId = inquiry.vehicle_id ?? vehicle?.id;
  const isCustom = inquiry.is_custom_request === true;
  const customSpecs = parseCustomRequestSpecs(inquiry.requested_specs);
  const budgetLabel = formatBudgetRangeGhs(inquiry.budget_min, inquiry.budget_max);
  const statusOptions = isCustom ? CUSTOM_REQUEST_STATUS_OPTIONS : LEAD_STATUS_OPTIONS;
  const followUpIntro = isCustom
    ? `Hi ${inquiry.name}, following up on your custom vehicle request for ${vehicleTitle}.`
    : `Hi ${inquiry.name}, following up on your pre-order for ${vehicleTitle}.`;
  const printRef = inquiry.reference_code ?? id.slice(0, 8).toUpperCase();

  return (
    <PrintableRecord
      title={isCustom ? "Custom Vehicle Request" : "Pre-Order Inquiry"}
      subtitle={`Submitted ${formatPlatformDateTime(inquiry.created_at)}`}
      reference={inquiry.reference_code ?? id.slice(0, 8).toUpperCase()}
    >
    <div className="space-y-6">
      {actionToast ? (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            actionToastError
              ? "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text-secondary)]"
              : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          }`}
        >
          {actionToast}
        </div>
      ) : null}
      {!canMutate ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800">
          Payment, status, and convert-to-sale actions require Owner or Super Admin. You can still
          message the customer.
        </p>
      ) : null}
      <PageHeader
        title={isCustom ? "Custom Vehicle Request" : "Pre-Order Inquiry"}
        description={`${isCustom ? "Custom request · " : ""}Submitted ${formatPlatformDateTime(inquiry.created_at)}${inquiry.reference_code ? ` · Ref ${inquiry.reference_code}` : ""}`}
        breadcrumb="Leads"
        backFallbackHref={`${platformPath("leads")}?tab=preorder`}
        backLabel="Back to leads"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PlatformPrintButton
              getHtml={() => buildAdminPreorderDocumentHtml(inquiry)}
              downloadFilename={`${isCustom ? "custom-request" : "preorder"}-${printRef}.pdf`}
            />
            <Link
              href={platformPath(
                `customers/${encodeURIComponent(
                  customerProfileIdForOrder({
                    userId: inquiry.user_id ?? null,
                    email: inquiry.email,
                  })
                )}`
              )}
              className="platform-btn-ghost inline-flex items-center gap-2"
            >
              <User className="size-4" />
              Customer profile
            </Link>
            {inquiry.phone ? (
              <WhatsAppAssistAction
                phone={inquiry.phone}
                customerName={inquiry.name}
                context={{
                  type: "preorder",
                  id,
                  userId: inquiry.user_id ?? undefined,
                  email: inquiry.email,
                }}
                variant="button"
              />
            ) : null}
            <Link
              href={
                inquiry.user_id
                  ? `/platform/messages?user=${encodeURIComponent(inquiry.user_id)}`
                  : `/platform/messages?email=${encodeURIComponent(inquiry.email)}`
              }
              className="platform-btn-primary inline-flex items-center gap-2"
            >
              <MessageSquare className="size-4" />
              Message customer
            </Link>
            {canMutate ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="platform-btn-ghost text-[var(--platform-error)]"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="platform-card overflow-hidden rounded-xl">
          <div className="border-b border-[var(--platform-border)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--platform-text)]">
              {isCustom ? "Requested vehicle" : "Vehicle"}
            </h2>
          </div>
          <div className="p-5">
            {isCustom ? (
              <div className="space-y-3 text-sm">
                <p className="text-lg font-semibold text-[var(--platform-text)]">{vehicleTitle}</p>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Make</dt>
                    <dd className="font-medium">{inquiry.requested_make ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Model</dt>
                    <dd className="font-medium">{inquiry.requested_model ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Year</dt>
                    <dd className="font-medium">{inquiry.requested_year ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Budget</dt>
                    <dd className="font-medium">{budgetLabel ?? "—"}</dd>
                  </div>
                  {customSpecs.body_type && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Body type</dt>
                      <dd className="font-medium">{customSpecs.body_type}</dd>
                    </div>
                  )}
                  {customSpecs.fuel_type && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Fuel type</dt>
                      <dd className="font-medium">{customSpecs.fuel_type}</dd>
                    </div>
                  )}
                  {customSpecs.condition && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Condition</dt>
                      <dd className="font-medium">{customSpecs.condition}</dd>
                    </div>
                  )}
                  {customSpecs.preferred_timeline && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Timeline</dt>
                      <dd className="font-medium">{customSpecs.preferred_timeline}</dd>
                    </div>
                  )}
                </dl>
                {customSpecs.notes && (
                  <div>
                    <p className="text-xs text-[var(--platform-text-secondary)]">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-[var(--platform-text)]">
                      {customSpecs.notes}
                    </p>
                  </div>
                )}
                {inquiry.matched_vehicle_id && canEditInventory && (
                  <Link
                    href={platformPath(`inventory/${inquiry.matched_vehicle_id}/edit`)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                  >
                    View matched listing
                    <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="relative size-28 shrink-0 overflow-hidden rounded-lg bg-[var(--platform-bg)]">
                  <SafeVehicleImage src={vehicleImage} alt={vehicleTitle} fill />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-lg font-semibold text-[var(--platform-text)]">{vehicleTitle}</p>
                  <p className="text-sm tabular-nums text-[var(--platform-text-secondary)]">
                    {formatPrice(vehiclePrice)}
                  </p>
                  {vehicle?.status && <StatusBadge status={vehicle.status} />}
                  {vehicleId && canEditInventory && (
                    <Link
                      href={platformPath(`inventory/${vehicleId}/edit`)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                    >
                      Edit in inventory
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="platform-card overflow-hidden rounded-xl">
          <div className="border-b border-[var(--platform-border)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--platform-text)]">Customer</h2>
          </div>
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
              <div>
                <p className="text-xs text-[var(--platform-text-secondary)]">Name</p>
                <p className="font-medium text-[var(--platform-text)]">{inquiry.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
              <div>
                <p className="text-xs text-[var(--platform-text-secondary)]">Email</p>
                <a
                  href={`mailto:${inquiry.email}`}
                  className="font-medium text-[var(--platform-accent)] hover:underline"
                >
                  {inquiry.email}
                </a>
              </div>
            </div>
            {inquiry.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
                <div>
                  <p className="text-xs text-[var(--platform-text-secondary)]">Phone</p>
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="font-medium text-[var(--platform-accent)] hover:underline"
                  >
                    {inquiry.phone}
                  </a>
                </div>
              </div>
            )}
            {inquiry.customer_registration_id && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
                <div>
                  <p className="text-xs text-[var(--platform-text-secondary)]">Registration ID</p>
                  <p className="font-mono font-medium text-[var(--platform-text)]">
                    {inquiry.customer_registration_id}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <User className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
              <div>
                <p className="text-xs text-[var(--platform-text-secondary)]">WhatsApp updates</p>
                <p className="font-medium text-[var(--platform-text)]">
                  {inquiry.whatsapp_opt_in === true
                    ? "Opted in"
                    : inquiry.whatsapp_opt_in === false
                      ? "Not opted in"
                      : "Not specified"}
                </p>
              </div>
            </div>
            {inquiry.message && (
              <div>
                <p className="text-xs text-[var(--platform-text-secondary)]">Message</p>
                <p className="mt-1 whitespace-pre-wrap text-[var(--platform-text)]">
                  {inquiry.message}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {!isCustom ? (
          <>
            <section className="platform-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
                Down payment (25%)
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
                {formatPrice(downPayment)}
              </p>
              <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                Based on {formatPrice(vehiclePrice)} vehicle price
              </p>
              <div className="mt-4 space-y-3">
                <PaymentStatusBadge status={inquiry.payment_status ?? "pending"} />
                {inquiry.payment_status !== "down_payment_paid" &&
                  inquiry.payment_status !== "completed" && (
                    <>
                      <button
                        type="button"
                        disabled={saving || !canMutate}
                        onClick={() => updateField({ payment_status: "down_payment_paid" })}
                        className="platform-btn-primary w-full disabled:opacity-50"
                        title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
                      >
                        Mark 25% payment received
                      </button>
                      <p className="text-xs text-[var(--platform-text-secondary)]">
                        Reserves the linked vehicle in inventory (available / pre-order → reserved),
                        then unlocks Convert to sale.
                      </p>
                    </>
                  )}
                {(inquiry.payment_status === "down_payment_paid" ||
                  inquiry.payment_status === "completed") && (
                  <>
                    {linkedSale ? (
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          Converted to sale · {linkedSale.status}
                        </p>
                        <Link
                          href={platformPath("sales")}
                          className="platform-btn-primary flex w-full items-center justify-center gap-2"
                        >
                          <FileText className="size-4" />
                          View sale
                        </Link>
                        <button
                          type="button"
                          disabled={reverting || !canMutate}
                          onClick={() => setShowRevert(true)}
                          className="platform-btn-ghost w-full text-[var(--platform-warning)] disabled:opacity-50"
                        >
                          <RotateCcw className="size-4" />
                          {reverting ? "Reverting…" : "Revert to pre-order"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={converting || !canMutate}
                        onClick={() => setShowConvert(true)}
                        className="platform-btn-primary w-full disabled:opacity-50"
                        title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
                      >
                        <FileText className="size-4" />
                        {converting ? "Converting…" : "Convert to sale"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="platform-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
                Shipping &amp; clearing
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--platform-text)]">
                {shippingHandlingLabel(inquiry.shipping_handling)}
              </p>
              <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">
                Terms accepted: {inquiry.shipping_terms_accepted ? "Yes" : "No"}
                {inquiry.shipping_terms_accepted_at && (
                  <> · {formatPlatformDateTime(inquiry.shipping_terms_accepted_at)}</>
                )}
              </p>
            </section>
          </>
        ) : (
          <section className="platform-card rounded-xl p-5 lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
              Sourcing follow-up
            </p>
            <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">
              Update status as you review whether this vehicle can be sourced. Link an inventory
              listing when one is added.
            </p>
            {inquiry.reference_code && (
              <p className="mt-3 font-mono text-sm font-semibold text-[var(--platform-text)]">
                {inquiry.reference_code}
              </p>
            )}
            {canEditInventory && (
              <div className="mt-4 space-y-2">
                <label className="block text-xs text-[var(--platform-text-secondary)]">
                  Matched inventory vehicle ID
                </label>
                <div className="flex gap-2">
                  <input
                    value={matchedVehicleId}
                    onChange={(e) => setMatchedVehicleId(e.target.value)}
                    placeholder="Vehicle UUID from inventory"
                    className="platform-input flex-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      updateField({
                        matched_vehicle_id: matchedVehicleId.trim() || null,
                        status: matchedVehicleId.trim() ? "matched" : inquiry.status,
                      })
                    }
                    className="platform-btn-primary shrink-0"
                  >
                    Save link
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="platform-card rounded-xl p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">
                Status
              </label>
              <select
                value={inquiry.status ?? (isCustom ? "reviewing" : "new")}
                disabled={saving || !canMutate}
                onChange={(e) => updateField({ status: e.target.value })}
                className="platform-select w-full"
                title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {isCustom ? customRequestStatusLabel(s) : s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">
                Source
              </label>
              <select
                value={inquiry.source ?? "website"}
                disabled={saving || !canMutate}
                onChange={(e) => updateField({ source: e.target.value })}
                className="platform-select w-full"
                title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
              >
                {LEAD_SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving) void updateField({ follow_up_notes: notes });
            }}
          >
            <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">
              Follow-up notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={4}
              disabled={!canMutate}
              className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm text-[var(--platform-text)] disabled:opacity-60"
              placeholder="Internal notes about this pre-order…"
            />
            <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
              Shift+Enter for new line · Enter to save
            </p>
            <button
              type="submit"
              disabled={saving || !canMutate}
              className="platform-btn-primary mt-2"
              title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
            >
              {saving ? "Saving…" : "Save notes"}
            </button>
          </form>
        </section>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete pre-order?"
        description={`Permanently remove ${inquiry.name}'s pre-order for ${vehicleTitle}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={showConvert}
        onOpenChange={setShowConvert}
        title="Convert pre-order to sale?"
        description={`Vehicle: ${vehicleTitle}\nCustomer: ${inquiry.name}\nDown payment: ${formatPrice(downPayment)}\n\nThis will create a sales record. You can revert if this was a mistake.`}
        confirmLabel="Confirm convert"
        onConfirm={convertToSale}
      />

      <ConfirmDialog
        open={showRevert}
        onOpenChange={setShowRevert}
        title="Revert this sale back to pre-order?"
        description={`This will cancel the linked sale for ${vehicleTitle} and restore the pre-order. The down payment status will be kept if payment was received.`}
        confirmLabel="Revert to pre-order"
        destructive
        onConfirm={revertToPreorder}
      />
    </div>
    </PrintableRecord>
  );
}
