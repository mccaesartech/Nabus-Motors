"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ExternalLink, KeyRound, MessageSquare, Package, Ship, ShoppingBag, Copy, Check, Trash2 } from "lucide-react";
import { ContactEmailAction, ContactPhoneAction, ContactWhatsAppAction } from "@/components/platform/contact-actions";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import {
  CustomerInvoicePrintButton,
  OrderInvoicePrintButton,
  PreorderInvoicePrintButton,
} from "@/components/platform/customer-invoice-print";
import { PrintableRecord } from "@/components/platform/printable-record";
import { useMarkNotificationsOnVisit } from "@/hooks/use-mark-notifications-read";
import { EmptyState } from "@/components/platform/empty-state";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { freightServiceLabel } from "@/lib/platform/freight-quote-display";
import { platformPath } from "@/lib/platform/paths";
import type { NotificationFeedbackVariant } from "@/lib/notifications/notification-status";
import type { AdminCustomerDetail } from "@/lib/platform/customers-admin";
import { PlatformDateLabel, PlatformDateTime } from "@/components/platform/platform-datetime";

export default function CustomerProfilePage() {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const customerId = decodeURIComponent(String(params.id ?? ""));
  const router = useRouter();
  useMarkNotificationsOnVisit({ link: pathname });
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [canSendReset, setCanSendReset] = useState(false);
  const [canCopyResetLink, setCanCopyResetLink] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [copyLinkLoading, setCopyLinkLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetMessageVariant, setResetMessageVariant] = useState<NotificationFeedbackVariant>("success");
  const [resetError, setResetError] = useState<string | null>(null);
  const [pendingResetUrl, setPendingResetUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    if (!res.ok || !json.customer) {
      setNotFound(true);
      setCustomer(null);
    } else {
      setCustomer(json.customer);
      setNotFound(false);
    }
    setLoading(false);
  }, [customerId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => res.json())
      .then((json) => {
        const user = json.user;
        const role = user?.role;
        setCanSendReset(
          Boolean(
            json.ok &&
              (user?.type === "owner" ||
                role === "owner" ||
                role === "super_admin" ||
                role === "manager" ||
                json.permissions?.customers)
          )
        );
        setCanCopyResetLink(
          Boolean(
            json.ok &&
              (user?.type === "owner" ||
                role === "owner" ||
                role === "super_admin" ||
                role === "manager")
          )
        );
        setCanDelete(Boolean(json.ok && json.canDeleteCustomers));
      })
      .catch(() => {
        setCanSendReset(false);
        setCanDelete(false);
      });
  }, []);

  async function copyResetLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      setResetError("Could not copy to clipboard — select and copy the link manually.");
    }
  }

  async function generateResetLink() {
    if (!customer?.userId) return;
    setCopyLinkLoading(true);
    setResetError(null);
    setPendingResetUrl(null);

    const res = await fetch(
      `/api/admin/customers/${encodeURIComponent(customerId)}/password-reset-link`,
      { method: "POST" }
    );
    const json = await res.json();

    if (!res.ok) {
      setResetError(json.message ?? "Could not generate reset link.");
    } else if (json.resetUrl) {
      setPendingResetUrl(String(json.resetUrl));
      await copyResetLink(String(json.resetUrl));
      setResetMessage(json.message ?? "Reset link copied to clipboard.");
      setResetMessageVariant("warning");
    }

    setCopyLinkLoading(false);
  }

  async function sendPasswordReset() {
    if (!customer?.userId) return;
    setResetLoading(true);
    setResetMessage(null);
    setResetError(null);
    setPendingResetUrl(null);
    setLinkCopied(false);

    const res = await fetch(
      `/api/admin/customers/${encodeURIComponent(customerId)}/send-password-reset`,
      { method: "POST" }
    );
    const json = await res.json();

    if (!res.ok) {
      setResetError(json.message ?? "Could not send password reset.");
      if (json.resetUrl) {
        setPendingResetUrl(String(json.resetUrl));
      }
    } else {
      setResetMessage(json.message ?? "Password reset link sent.");
      setResetMessageVariant((json.notificationVariant as NotificationFeedbackVariant) ?? "success");
    }

    setResetLoading(false);
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteMessage(null);

    const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
      method: "DELETE",
    });
    const json = await res.json();

    if (!res.ok) {
      setDeleteMessage(json.message ?? "Could not delete customer.");
      setDeleteLoading(false);
      throw new Error(json.message ?? "Could not delete customer.");
    }

    router.push(`${platformPath("customers")}?deleted=1`);
  }

  const messageHref = useMemo(() => {
    if (!customer?.email) return platformPath("messages");
    if (customer.userId) {
      return `/platform/messages?user=${encodeURIComponent(customer.userId)}`;
    }
    return `/platform/messages?email=${encodeURIComponent(customer.email)}`;
  }, [customer]);

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading profile…</p>;
  }

  if (notFound || !customer) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-5" />}
        title="Customer not found"
        description="This profile may have been removed or the link is invalid."
        action={
          <Link href={platformPath("customers")} className="platform-btn-ghost text-sm">
            Back to customers
          </Link>
        }
      />
    );
  }

  return (
    <PrintableRecord
      title={customer.name}
      subtitle="Customer profile summary"
      reference={customer.registrationId ?? undefined}
    >
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description="Customer profile with freight quotes, pre-orders, and shipments."
        breadcrumb="AUTO · Customers"
        backFallbackHref={platformPath("customers")}
        backLabel="Back to customers"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CustomerInvoicePrintButton customerId={customer.id} customer={customer} />
            {canSendReset && customer.userId ? (
              <button
                type="button"
                onClick={() => void sendPasswordReset()}
                disabled={resetLoading}
                className="platform-btn-ghost inline-flex items-center gap-2"
                title="Sends a secure reset link — you never see the customer's password"
              >
                <KeyRound className="size-4" />
                {resetLoading ? "Sending…" : "Send password reset"}
              </button>
            ) : null}
            {canCopyResetLink && customer.userId ? (
              <button
                type="button"
                onClick={() => void generateResetLink()}
                disabled={copyLinkLoading}
                className="platform-btn-ghost inline-flex items-center gap-2"
                title="Generate a one-time link and copy to clipboard — send via WhatsApp if email fails"
              >
                {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copyLinkLoading ? "Generating…" : linkCopied ? "Link copied" : "Copy reset link"}
              </button>
            ) : null}
            {customer.email ? (
              <Link href={messageHref} className="platform-btn-primary inline-flex items-center gap-2">
                <MessageSquare className="size-4" />
                Message customer
              </Link>
            ) : null}
          </div>
        }
      />

      {(resetMessage || resetError) && (
        <div className="space-y-3">
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              resetError
                ? "border border-red-200 bg-red-50 text-red-800"
                : resetMessageVariant === "warning"
                  ? "border border-amber-200 bg-amber-50 text-amber-900"
                  : resetMessageVariant === "neutral"
                    ? "border border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-secondary)]"
                    : "border border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {resetError ?? resetMessage}
          </p>
          {pendingResetUrl && resetError ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="flex-1 min-w-[12rem]">
                Email failed — copy the one-time link and send it to the customer on WhatsApp. It
                expires soon.
              </p>
              <button
                type="button"
                onClick={() => void copyResetLink(pendingResetUrl)}
                className="platform-btn-secondary inline-flex items-center gap-2 text-sm"
              >
                {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {linkCopied ? "Copied" : "Copy reset link"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="platform-card rounded-xl p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold">Contact details</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {customer.registrationId && (
              <li>
                <p className="text-xs text-[var(--platform-text-secondary)]">Registration ID</p>
                <p className="font-mono font-medium">{customer.registrationId}</p>
              </li>
            )}
            <li>
              <p className="text-xs text-[var(--platform-text-secondary)]">Email</p>
              <ContactEmailAction email={customer.email} variant="detail" />
            </li>
            {customer.phone && (
              <li>
                <p className="text-xs text-[var(--platform-text-secondary)]">Phone</p>
                <ContactPhoneAction phone={customer.phone} variant="detail" />
                <div className="mt-2">
                  <ContactWhatsAppAction
                    phone={customer.phone}
                    customerName={customer.name}
                  />
                </div>
              </li>
            )}
            <li>
              <p className="text-xs text-[var(--platform-text-secondary)]">WhatsApp updates</p>
              <p>
                {customer.whatsappOptIn === true
                  ? "Opted in"
                  : customer.whatsappOptIn === false
                    ? "Not opted in"
                    : "Not specified"}
              </p>
            </li>
            <li>
              <PlatformDateLabel label="Account created" value={customer.accountCreatedAt} />
            </li>
          </ul>
        </div>

        <div className="platform-card rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Activity summary</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--platform-border)] p-4">
              <p className="text-xs text-[var(--platform-text-secondary)]">Cart orders</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{customer.ordersCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--platform-border)] p-4">
              <p className="text-xs text-[var(--platform-text-secondary)]">Freight quotes</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{customer.quotesCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--platform-border)] p-4">
              <p className="text-xs text-[var(--platform-text-secondary)]">Pre-orders</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{customer.preordersCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--platform-border)] p-4">
              <p className="text-xs text-[var(--platform-text-secondary)]">Shipments</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{customer.shipmentsCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-5 py-4">
          <ShoppingBag className="size-4 text-[var(--platform-accent)]" />
          <h2 className="text-sm font-semibold">Recent cart orders</h2>
        </div>
        <div className="divide-y divide-[var(--platform-border)]">
          {customer.recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--platform-text-secondary)]">
              No cart orders yet.
            </p>
          ) : (
            customer.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-mono text-sm font-medium">
                    {order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                    {order.totalLabel} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                    <PlatformDateTime value={order.createdAt} className="text-xs" /> · {order.status}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <OrderInvoicePrintButton orderId={order.id} />
                  <Link
                    href={platformPath(`leads/order/${order.id}`)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                  >
                    View order
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-5 py-4">
          <Package className="size-4 text-[var(--platform-accent)]" />
          <h2 className="text-sm font-semibold">Recent freight quotes</h2>
        </div>
        <div className="divide-y divide-[var(--platform-border)]">
          {customer.recentQuotes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--platform-text-secondary)]">
              No freight quotes yet.
            </p>
          ) : (
            customer.recentQuotes.map((quote) => (
              <div
                key={quote.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-mono text-sm font-medium">
                    {quote.referenceCode ?? "No reference"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                    {freightServiceLabel(quote.serviceType)} · {quote.originCountry ?? "—"} →{" "}
                    {quote.destination ?? "Ghana"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                    <PlatformDateTime value={quote.createdAt} className="text-xs" /> · {quote.status}
                  </p>
                </div>
                <Link
                  href={`${platformPath("freight/quotes")}?quote=${encodeURIComponent(quote.id)}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                >
                  View quote
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-5 py-4">
            <ShoppingBag className="size-4 text-[var(--platform-accent)]" />
            <h2 className="text-sm font-semibold">Recent pre-orders</h2>
          </div>
          <div className="divide-y divide-[var(--platform-border)]">
            {customer.recentPreorders.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[var(--platform-text-secondary)]">
                No pre-orders yet.
              </p>
            ) : (
              customer.recentPreorders.map((preorder) => (
                <div key={preorder.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">
                      {preorder.vehicleLabel ?? "Vehicle pre-order"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                      {preorder.referenceCode ? (
                        <span className="font-mono">{preorder.referenceCode}</span>
                      ) : null}
                      {preorder.referenceCode ? " · " : ""}
                      <PlatformDateTime value={preorder.createdAt} mode="date" className="text-xs" /> · {preorder.status}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <PreorderInvoicePrintButton preorderId={preorder.id} />
                    <Link
                      href={platformPath(`leads/preorder/${preorder.id}`)}
                      className="inline-block text-xs text-[var(--platform-accent)] hover:underline"
                    >
                      View pre-order
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="platform-card overflow-hidden rounded-xl">
          <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-5 py-4">
            <Ship className="size-4 text-[var(--platform-accent)]" />
            <h2 className="text-sm font-semibold">Recent shipments</h2>
          </div>
          <div className="divide-y divide-[var(--platform-border)]">
            {customer.recentShipments.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[var(--platform-text-secondary)]">
                No shipments yet.
              </p>
            ) : (
              customer.recentShipments.map((shipment) => (
                <div key={shipment.id} className="px-5 py-4">
                  <p className="font-mono text-sm font-medium">{shipment.trackingNumber}</p>
                  <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                    {shipment.destination ?? "Ghana"} ·{" "}
                    <PlatformDateTime value={shipment.createdAt} mode="date" className="text-xs" /> · {shipment.status}
                  </p>
                  <Link
                    href={`${platformPath("freight/tracking")}?shipment=${encodeURIComponent(shipment.id)}`}
                    className="mt-2 inline-block text-xs text-[var(--platform-accent)] hover:underline"
                  >
                    View shipment
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <CustomerDataTrustNote variant="admin" />

      {canDelete && !customer.deletedAt ? (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
          <h2 className="text-sm font-semibold text-red-900">Danger zone</h2>
          <p className="mt-2 text-sm text-red-800">
            Remove this customer from the active directory. Their freight quotes, pre-orders, and
            shipments stay in the system for records.
          </p>
          {deleteMessage ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-800">
              {deleteMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            disabled={deleteLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <Trash2 className="size-4" />
            Delete customer
          </button>
        </div>
      ) : null}

      {customer.deletedAt ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This customer was removed on <PlatformDateTime value={customer.deletedAt} />.
        </p>
      ) : null}

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={`Delete ${customer.name}?`}
        description={`This cannot be undone.\n\nTheir profile will be removed from the customer list. Existing orders, pre-orders, and messages will be kept for your records.`}
        confirmLabel="Delete customer"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={handleDelete}
      />
    </div>
    </PrintableRecord>
  );
}
