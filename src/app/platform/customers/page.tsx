"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Search, Trash2 } from "lucide-react";
import { ContactEmailAction, ContactPhoneAction } from "@/components/platform/contact-actions";
import { CustomerInvoicePrintButton } from "@/components/platform/customer-invoice-print";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import type { AdminCustomerDetail, AdminCustomerListItem } from "@/lib/platform/customers-admin";
import { hasCustomerActivity } from "@/lib/platform/customers-admin";
import { seedCachedCustomer } from "@/lib/print/pdf-cache";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showSignUps, setShowSignUps] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCustomerListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, AdminCustomerDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const load = useCallback(async (query?: string, includeDeleted?: boolean, includeSignUps?: boolean) => {
    const params = new URLSearchParams();
    if (query?.trim()) params.set("search", query.trim());
    if (includeDeleted) params.set("showDeleted", "1");
    if (includeSignUps) params.set("showSignUps", "1");
    const qs = params.toString();
    const res = await fetch(`/api/admin/customers${qs ? `?${qs}` : ""}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setCustomers(json.customers ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => res.json())
      .then((json) => setCanDelete(Boolean(json.ok && json.canDeleteCustomers)))
      .catch(() => setCanDelete(false));
  }, []);

  useEffect(() => {
    if (searchParams.get("deleted") === "1") {
      setSuccessMessage("Customer removed from the directory.");
      router.replace(platformPath("customers"), { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(search, showDeleted, showSignUps);
    }, 250);
    return () => clearTimeout(timer);
  }, [load, search, showDeleted, showSignUps]);

  async function loadDetail(id: string) {
    if (detailById[id]) return;
    setDetailLoadingId(id);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (res.ok && json.customer) {
        const detail = json.customer as AdminCustomerDetail;
        seedCachedCustomer(detail);
        setDetailById((prev) => ({ ...prev, [id]: detail }));
      }
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function toggleExpanded(customer: AdminCustomerListItem) {
    const next = expandedId === customer.id ? null : customer.id;
    setExpandedId(next);
    if (next) {
      await loadDetail(next);
    }
  }

  async function deleteCustomer(customer: AdminCustomerListItem) {
    const snapshot = customers;
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    if (expandedId === customer.id) setExpandedId(null);
    setDetailById((prev) => {
      if (!(customer.id in prev)) return prev;
      const next = { ...prev };
      delete next[customer.id];
      return next;
    });
    setDeleteTarget(null);

    const res = await fetch(`/api/admin/customers/${encodeURIComponent(customer.id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      setCustomers(snapshot);
      setSuccessMessage(json.message ?? "Could not delete customer.");
      throw new Error(json.message ?? "Could not delete customer.");
    }
    setSuccessMessage(json.message ?? "Customer removed from the directory.");
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading customers…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customers with quotes, pre-orders, orders, or shipments. Search by email or name to find new sign-ups before their first activity."
        breadcrumb="AUTO · Customers"
      />

      {!showSignUps && !search.trim() ? (
        <p className="rounded-lg border border-[var(--platform-border)] bg-[rgba(37,99,235,0.04)] px-4 py-3 text-sm text-[var(--platform-text-secondary)]">
          Showing customers with business activity only. New account sign-ups appear here after
          their first quote, pre-order, or purchase — or enable{" "}
          <span className="font-medium text-[var(--platform-text)]">Show sign-ups without activity</span>{" "}
          below, or search by their email.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or quote reference…"
            className="platform-input platform-input--icon"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--platform-text-secondary)]">
          <input
            type="checkbox"
            checked={showSignUps}
            onChange={(e) => setShowSignUps(e.target.checked)}
            className="size-4 rounded border-[var(--platform-border)]"
          />
          Show sign-ups without activity
        </label>
        {canDelete ? (
          <label className="flex items-center gap-2 text-sm text-[var(--platform-text-secondary)]">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="size-4 rounded border-[var(--platform-border)]"
            />
            Show deleted
          </label>
        ) : null}
      </div>

      {successMessage ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            successMessage.includes("Could not")
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {successMessage}
        </p>
      ) : null}

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="max-h-[min(70vh,48rem)] overflow-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="w-10 px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Account created</th>
                <th className="px-4 py-3 font-medium">Quotes</th>
                <th className="px-4 py-3 font-medium">Pre-orders</th>
                <th className="px-4 py-3 font-medium">Shipments</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    No customers found.
                    {!showSignUps && !search.trim()
                      ? " Try searching by email, or enable sign-ups without activity."
                      : " Freight quotes and pre-orders will populate this directory."}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const expanded = expandedId === customer.id;
                  const detail = detailById[customer.id];
                  return (
                    <Fragment key={customer.id}>
                      <tr className="border-t border-[var(--platform-border)]">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-accent)]"
                            onClick={() => void toggleExpanded(customer)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Collapse row" : "Expand row"}
                          >
                            {expanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <span className="inline-flex items-center gap-2">
                            {customer.name}
                            {!hasCustomerActivity(customer) ? (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                Sign-up only
                              </span>
                            ) : null}
                            {customer.deletedAt ? (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                Deleted
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ContactEmailAction email={customer.email} />
                        </td>
                        <td className="px-4 py-3">
                          {customer.phone ? (
                            <ContactPhoneAction phone={customer.phone} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {customer.whatsappOptIn === true
                            ? "Opted in"
                            : customer.whatsappOptIn === false
                              ? "No"
                              : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                          <PlatformDateTime value={customer.accountCreatedAt} mode="date" className="text-xs" />
                        </td>
                        <td className="px-4 py-3 tabular-nums">{customer.quotesCount}</td>
                        <td className="px-4 py-3 tabular-nums">{customer.preordersCount}</td>
                        <td className="px-4 py-3 tabular-nums">{customer.shipmentsCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <CustomerInvoicePrintButton
                              customerId={customer.id}
                              customer={detail}
                              compact
                            />
                            <Link
                              href={platformPath(`customers/${encodeURIComponent(customer.id)}`)}
                              className="text-xs text-[var(--platform-accent)] hover:underline"
                            >
                              Full profile
                            </Link>
                            {canDelete && !customer.deletedAt ? (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(customer)}
                                className="text-xs text-red-600 hover:text-red-800"
                                aria-label={`Delete ${customer.name}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={10} className="bg-[rgba(37,99,235,0.04)] px-4 py-4">
                            {detailLoadingId === customer.id && !detail ? (
                              <p className="text-sm text-[var(--platform-text-secondary)]">
                                Loading details…
                              </p>
                            ) : (
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-2 text-sm">
                                  <p>
                                    <span className="text-[var(--platform-text-secondary)]">
                                      Registration ID:{" "}
                                    </span>
                                    <span className="font-mono">
                                      {customer.registrationId ?? "—"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-[var(--platform-text-secondary)]">
                                      Email:{" "}
                                    </span>
                                    {customer.email}
                                  </p>
                                  {customer.phone && (
                                    <p>
                                      <span className="text-[var(--platform-text-secondary)]">
                                        Phone:{" "}
                                      </span>
                                      {customer.phone}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                                    Recent freight quotes
                                  </p>
                                  {detail?.recentQuotes?.length ? (
                                    <ul className="mt-2 space-y-2 text-sm">
                                      {detail.recentQuotes.slice(0, 5).map((quote) => (
                                        <li key={quote.id}>
                                          <Link
                                            href={`${platformPath("freight/quotes")}?quote=${encodeURIComponent(quote.id)}`}
                                            className="text-[var(--platform-accent)] hover:underline"
                                          >
                                            {quote.referenceCode ?? "Quote"} —{" "}
                                            <PlatformDateTime value={quote.createdAt} mode="date" className="text-xs" />
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">
                                      No freight quotes yet.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerDataTrustNote variant="admin" />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete customer?"}
        description={
          deleteTarget
            ? `This cannot be undone.\n\nTheir profile will be removed from the customer list. Existing orders, pre-orders, and messages will be kept for your records.`
            : ""
        }
        confirmLabel="Delete customer"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => {
          if (!deleteTarget) return;
          return deleteCustomer(deleteTarget);
        }}
      />
    </div>
  );
}
