"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  MessageSquare,
  Package,
  ShoppingBag,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import {
  PlatformPrintButton,
  PrintableRecord,
  PrintField,
  PrintSection,
} from "@/components/platform/printable-record";
import { buildAdminOrderDocumentHtml } from "@/lib/platform/printable-documents";
import { useMarkNotificationsOnVisit } from "@/hooks/use-mark-notifications-read";
import { WhatsAppAssistAction } from "@/components/platform/whatsapp-assist-dialog";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { StatusBadge } from "@/components/platform/status-badge";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import {
  canDirectMutate,
  MUTATION_APPROVAL_REQUIRED_MESSAGE,
} from "@/lib/platform/mutation-approval";
import { ORDER_STATUS_OPTIONS } from "@/lib/platform/types";
import { customerProfileIdForOrder } from "@/lib/platform/order-profile";
import type { AdminOrderDetail } from "@/lib/platform/orders-admin";
import { seedCachedOrder } from "@/lib/print/pdf-cache";
import { formatPlatformDateTime } from "@/lib/platform/datetime";
import type { NotificationFeedbackVariant } from "@/lib/notifications/notification-status";

export default function OrderDetailPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams();
  const id = String(params.id ?? "");
  const session = usePlatformSession();
  const canMutate = session ? canDirectMutate(session.role) : false;
  useMarkNotificationsOnVisit({ link: pathname });
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [confirmToast, setConfirmToast] = useState<string | null>(null);
  const [confirmToastVariant, setConfirmToastVariant] =
    useState<NotificationFeedbackVariant>("success");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return;
      }
      setOrder(null);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const row = json.order as AdminOrderDetail;
    seedCachedOrder(row);
    setOrder(row);
    setNotes(row.notes ?? "");
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const customerProfileHref = useMemo(() => {
    if (!order) return platformPath("customers");
    return platformPath(`customers/${encodeURIComponent(customerProfileIdForOrder(order))}`);
  }, [order]);

  const messageHref = useMemo(() => {
    if (!order?.email) return platformPath("messages");
    const params = new URLSearchParams();
    if (order.userId) params.set("user", order.userId);
    else params.set("email", order.email);
    params.set("name", order.name);
    if (order.phone) params.set("phone", order.phone);
    params.set("order", order.id);
    params.set(
      "subject",
      `Cart order ${order.id.slice(0, 8).toUpperCase()}`
    );
    params.set(
      "draft",
      `Hi ${order.name}, following up on your Nabus Motors cart order (${order.id.slice(0, 8).toUpperCase()}). `
    );
    return `/platform/messages?${params.toString()}`;
  }, [order]);

  async function updateOrder(updates: { status?: string; notes?: string }) {
    if (!order) return;
    if (!canMutate) {
      setConfirmToast(MUTATION_APPROVAL_REQUIRED_MESSAGE);
      setConfirmToastVariant("warning");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || json.ok === false) {
      setConfirmToast(
        String(json.message ?? MUTATION_APPROVAL_REQUIRED_MESSAGE)
      );
      setConfirmToastVariant("warning");
      return;
    }
    if (json.notificationMessage) {
      setConfirmToast(String(json.notificationMessage));
      setConfirmToastVariant(
        (json.notificationVariant as NotificationFeedbackVariant) ?? "success"
      );
    } else {
      setConfirmToast("Order updated.");
      setConfirmToastVariant("success");
    }
    if (json.order) {
      const row = json.order as AdminOrderDetail;
      seedCachedOrder(row);
      setOrder(row);
      if (updates.notes !== undefined) setNotes(row.notes ?? "");
    } else {
      void load();
    }
  }

  async function confirmOrder() {
    if (!order || order.status === "confirmed") return;
    if (!canMutate) {
      setConfirmToast(MUTATION_APPROVAL_REQUIRED_MESSAGE);
      setConfirmToastVariant("warning");
      return;
    }
    setConfirming(true);
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    const json = await res.json().catch(() => ({}));
    setConfirming(false);
    if (!res.ok || json.ok === false) {
      setConfirmToast(
        String(json.message ?? MUTATION_APPROVAL_REQUIRED_MESSAGE)
      );
      setConfirmToastVariant("warning");
      return;
    }
    if (json.notificationMessage) {
      setConfirmToast(String(json.notificationMessage));
      setConfirmToastVariant(
        (json.notificationVariant as NotificationFeedbackVariant) ?? "success"
      );
    } else {
      setConfirmToast("Order confirmed.");
      setConfirmToastVariant("success");
    }
    if (json.order) {
      const row = json.order as AdminOrderDetail;
      seedCachedOrder(row);
      setOrder(row);
    } else {
      void load();
    }
  }

  async function sendPasswordReset() {
    if (!order) return;
    setResetLoading(true);
    setResetMessage(null);
    const customerId = customerProfileIdForOrder(order);
    const res = await fetch(
      `/api/admin/customers/${encodeURIComponent(customerId)}/send-password-reset`,
      { method: "POST" }
    );
    const json = await res.json();
    setResetLoading(false);
    if (!res.ok) {
      setResetMessage(json.message ?? "Could not send password reset.");
      return;
    }
    setResetMessage("Password reset email sent.");
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading order…</p>;
  }

  if (!order) {
    return (
      <PageHeader
        title="Order not found"
        breadcrumb="Leads"
        backFallbackHref={`${platformPath("leads")}?tab=order`}
        backLabel="Back to leads"
      />
    );
  }

  const orderRef = order.id.slice(0, 8).toUpperCase();
  const canConfirm = order.status === "pending";
  const hasVehicleLines = order.vehicleCount > 0;

  return (
    <PrintableRecord
      title="Cart Order"
      subtitle={`Submitted ${formatPlatformDateTime(order.createdAt)} · ${order.totalLabel}`}
      reference={orderRef}
    >
    <div className="space-y-6">
      {confirmToast ? (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            confirmToastVariant === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text-secondary)]"
              : confirmToastVariant === "neutral"
                ? "border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-secondary)]"
                : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          }`}
        >
          {confirmToast}
        </div>
      ) : null}
      <section className="platform-card no-print rounded-xl border border-[var(--platform-accent)]/20 bg-[rgba(139,92,246,0.04)] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-accent)]">
          How to process this order
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-[var(--platform-text-secondary)]">
          <li>
            {canConfirm
              ? "Click Confirm order (Owner / Super Admin) to accept it and reserve any linked vehicles."
              : "Order is already past pending — advance Status as fulfillment progresses."}
          </li>
          <li>Message or WhatsApp the customer to arrange payment / pickup.</li>
          <li>
            Set Status to shipped → fulfilled when done
            {hasVehicleLines
              ? ". Completing a Sale marks the vehicle sold if you convert via Sales."
              : "."}
          </li>
        </ol>
        {!canMutate ? (
          <p className="mt-3 text-xs text-amber-700">
            Status changes require Owner or Super Admin. You can still message the customer.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={messageHref} className="platform-btn-primary inline-flex items-center gap-2">
            <MessageSquare className="size-4" />
            Message customer
          </Link>
          {order.phone ? (
            <WhatsAppAssistAction
              phone={order.phone}
              customerName={order.name}
              context={{
                type: "order",
                id,
                userId: order.userId ?? undefined,
                email: order.email,
              }}
              variant="button"
            />
          ) : null}
          {canConfirm ? (
            <button
              type="button"
              disabled={confirming || !canMutate}
              onClick={() => void confirmOrder()}
              className="platform-btn-ghost inline-flex items-center gap-2 border border-emerald-500/40 text-emerald-700 disabled:opacity-50"
              title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
            >
              <CheckCircle2 className="size-4" />
              {confirming ? "Confirming…" : "Confirm order"}
            </button>
          ) : null}
          <Link href={customerProfileHref} className="platform-btn-ghost inline-flex items-center gap-2">
            <User className="size-4" />
            Customer profile
          </Link>
          {order.userId || order.email ? (
            <button
              type="button"
              disabled={resetLoading}
              onClick={() => void sendPasswordReset()}
              className="platform-btn-ghost inline-flex items-center gap-2"
            >
              <KeyRound className="size-4" />
              {resetLoading ? "Sending…" : "Send password reset"}
            </button>
          ) : null}
          {order.appointment ? (
            <Link
              href={platformPath("appointments")}
              className="platform-btn-ghost inline-flex items-center gap-2"
            >
              <Calendar className="size-4" />
              View appointment
            </Link>
          ) : null}
        </div>
        {resetMessage ? (
          <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">{resetMessage}</p>
        ) : null}
      </section>

      <PageHeader
        title="Cart order"
        description={`Submitted ${formatPlatformDateTime(order.createdAt)} · ${order.totalLabel} · Ref ${orderRef}`}
        breadcrumb="Leads"
        backFallbackHref={`${platformPath("leads")}?tab=order`}
        backLabel="Back to leads"
        actions={
          <PlatformPrintButton
            getHtml={() => buildAdminOrderDocumentHtml(order)}
            downloadFilename={`order-${orderRef}.pdf`}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PrintSection title="Customer">
          <div className="space-y-4 text-sm">
            <PrintField label="Name" value={order.name} />
            <PrintField label="Email" value={order.email} />
            {order.phone ? <PrintField label="Phone" value={order.phone} /> : null}
            <PrintField label="Order ID" value={<span className="font-mono">{order.id}</span>} />
            <div className="grid gap-3 sm:grid-cols-2">
              <PrintField label="Created" value={formatPlatformDateTime(order.createdAt)} />
              <PrintField label="Last updated" value={formatPlatformDateTime(order.updatedAt)} />
            </div>
          </div>
        </PrintSection>

        <section className="platform-card rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Order total
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
            {order.totalLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
            {order.vehicleCount > 0 ? ` · ${order.vehicleCount} vehicle(s)` : ""}
            {order.partCount > 0 ? ` · ${order.partCount} part(s)` : ""}
          </p>
          <div className="mt-4">
            <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">Status</label>
            <select
              value={order.status}
              disabled={saving || !canMutate}
              onChange={(e) => void updateOrder({ status: e.target.value })}
              className="platform-select w-full"
              title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
            >
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <div className="mt-2">
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-2 hidden text-sm capitalize print:block">
              Status: {order.status}
            </p>
            {order.status === "confirmed" ? (
              <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">
                Confirmed {formatPlatformDateTime(order.confirmedAt ?? order.updatedAt)}
                {hasVehicleLines
                  ? " · Linked available vehicles were reserved in inventory."
                  : ""}
              </p>
            ) : null}
          </div>
          {order.appointment ? (
            <div className="mt-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-xs">
              <p className="font-medium text-[var(--platform-text)]">Linked appointment</p>
              <p className="mt-1 text-[var(--platform-text-secondary)]">
                {order.appointment.preferredDate ?? "Date TBD"}
                {order.appointment.preferredTime ? ` · ${order.appointment.preferredTime}` : ""}
                {order.appointment.branch ? ` · ${order.appointment.branch}` : ""}
              </p>
              <p className="mt-1 capitalize text-[var(--platform-text-secondary)]">
                Status: {order.appointment.status}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <section className="platform-card overflow-hidden rounded-xl">
        <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-5 py-4">
          <ShoppingBag className="size-4 text-[var(--platform-accent)]" />
          <h2 className="text-sm font-semibold">Line items</h2>
        </div>
        <ul className="divide-y divide-[var(--platform-border)]">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 flex-1 gap-3">
                {item.itemType === "vehicle" && item.vehicleImageUrl ? (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[var(--platform-bg)]">
                    <SafeVehicleImage
                      src={item.vehicleImageUrl}
                      alt={item.name}
                      width={64}
                      height={64}
                      fill={false}
                    />
                  </div>
                ) : item.itemType === "vehicle" ? (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-[var(--platform-bg)]">
                    <Package className="size-5 text-[var(--platform-accent)]" />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--platform-text)]">{item.name}</p>
                    {item.itemType === "vehicle" && item.itemIntent ? (
                      <span className="rounded-full bg-[var(--platform-bg)] px-2 py-0.5 text-xs text-[var(--platform-text-secondary)]">
                        {item.itemIntent === "pre_order" ? "Pre-order" : "Buy"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                    {item.itemType === "part" && item.sku ? `SKU ${item.sku} · ` : ""}
                    Qty {item.quantity} · {item.unitPriceLabel} each
                  </p>
                  {item.slug && item.itemType === "vehicle" ? (
                    <Link
                      href={`/auto/inventory/${item.slug}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on site
                      <ExternalLink className="size-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
              <p className="text-sm font-semibold tabular-nums">{item.lineTotalLabel}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="platform-card no-print rounded-xl p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) void updateOrder({ notes });
          }}
        >
          <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">
            Order notes
          </label>
          <p className="mb-2 text-xs text-[var(--platform-text-secondary)]">
            Includes any notes the customer left at checkout. Staff can add follow-up notes here.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={!canMutate}
            className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm text-[var(--platform-text)] disabled:opacity-60"
            placeholder="Follow-up notes for this order…"
          />
          <button
            type="submit"
            disabled={saving || !canMutate}
            className="platform-btn-primary mt-3"
            title={!canMutate ? MUTATION_APPROVAL_REQUIRED_MESSAGE : undefined}
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </form>
      </section>
    </div>
    </PrintableRecord>
  );
}
