"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/page-header";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { SaleStatusBadge } from "@/components/platform/status-badge";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { downloadCsv } from "@/lib/platform/data";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import {
  exportSalesCsv,
  SALE_STATUSES,
  type SaleRow,
  saleStatusLabel,
} from "@/lib/platform/sales";
import type { DbVehicle } from "@/lib/platform/types";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type ConvertiblePreorder = {
  id: string;
  name: string;
  email: string;
  down_payment_usd?: number;
  vehicle_price_usd?: number | null;
  vehicle?: {
    year: number;
    make: string;
    model: string;
    price: number;
  } | null;
};

function vehicleLabel(v: SaleRow["vehicle"]) {
  if (!v) return "—";
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
}

function defaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function SalesPage() {
  const router = useRouter();
  const { formatPrice } = usePlatformCurrency();
  const searchParams = useSearchParams();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [convertible, setConvertible] = useState<ConvertiblePreorder[]>([]);
  const [vehicles, setVehicles] = useState<DbVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertTarget, setConvertTarget] = useState<ConvertiblePreorder | null>(null);
  const [completeTarget, setCompleteTarget] = useState<SaleRow | null>(null);
  const [revertTarget, setRevertTarget] = useState<SaleRow | null>(null);

  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  const load = useCallback(async () => {
    const [salesRes, vehiclesRes] = await Promise.all([
      fetch("/api/admin/sales"),
      fetch("/api/admin/vehicles"),
    ]);

    if (isAdminAuthError(salesRes)) {
      router.push(adminLoginPath());
      return;
    }

    const salesJson = await salesRes.json();
    setSales(salesJson.sales ?? []);
    setConvertible(salesJson.convertiblePreorders ?? []);

    if (vehiclesRes.ok) {
      const vehiclesJson = await vehiclesRes.json();
      const list = (vehiclesJson.vehicles ?? []).filter(
        (v: DbVehicle) => v.status !== "sold"
      );
      setVehicles(list);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const activeSales = useMemo(() => {
    const list = sales.filter((sale) => sale.status !== "cancelled");
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((sale) => {
      const vehicle = vehicleLabel(sale.vehicle);
      return (
        (sale.customer_name ?? "").toLowerCase().includes(q) ||
        (sale.customer_email ?? "").toLowerCase().includes(q) ||
        vehicle.toLowerCase().includes(q) ||
        String(sale.status).toLowerCase().includes(q)
      );
    });
  }, [sales, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { draft: 0, sent: 0, accepted: 0, completed: 0 };
    for (const s of sales) {
      if (s.status === "cancelled") continue;
      const key = s.status in map ? s.status : "draft";
      map[key] += 1;
    }
    return map;
  }, [sales]);

  function onVehicleChange(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v && !salePrice) setSalePrice(String(v.price));
  }

  async function createQuotation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        customer_name: customerName,
        customer_email: customerEmail,
        sale_price: Number(salePrice),
        valid_until: validUntil,
        notes: notes || null,
        status: "draft",
      }),
    });
    setSaving(false);
    if (res.ok) {
      setToast("Quotation created.");
      setShowForm(false);
      setVehicleId("");
      setCustomerName("");
      setCustomerEmail("");
      setSalePrice("");
      setValidUntil(defaultValidUntil());
      setNotes("");
      load();
    }
  }

  async function convertPreorder(preorderId: string) {
    setSaving(true);
    const res = await fetch("/api/admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preorder_inquiry_id: preorderId }),
    });
    setSaving(false);
    if (res.ok) {
      setToast("Pre-order converted to sale.");
      load();
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/admin/sales", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      if (status === "completed") {
        setToast(
          "Sale completed — vehicle marked sold, or moved to pre-order if it was the last available unit."
        );
      }
      load();
    }
  }

  function onStatusChange(sale: SaleRow, nextStatus: string) {
    if (nextStatus === "completed") {
      setCompleteTarget(sale);
      return;
    }
    updateStatus(sale.id, nextStatus);
  }

  async function revertSale(saleId: string) {
    setSaving(true);
    const res = await fetch("/api/admin/sales", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: saleId, action: "revert" }),
    });
    setSaving(false);
    if (res.ok) {
      setToast("Sale reverted to pre-order.");
      load();
    }
  }

  async function removeSale(id: string) {
    const res = await fetch(`/api/admin/sales?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  function exportCsv() {
    downloadCsv(
      `true-goshen-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      exportSalesCsv(sales)
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading sales…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Quotations, deal pipeline, and pre-order conversions."
        breadcrumb="Sales"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportCsv} className="platform-btn-ghost">
              <Download className="size-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="platform-btn-primary"
            >
              <Plus className="size-4" />
              New quotation
            </button>
          </div>
        }
      />

      {toast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]">
          {toast}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SALE_STATUSES.map((status) => (
          <StatCard
            key={status}
            label={saleStatusLabel(status)}
            value={String(counts[status] ?? 0)}
          />
        ))}
      </div>

      {convertible.length > 0 && (
        <div className="platform-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">
            Ready to convert
          </h2>
          <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
            Pre-orders with down payment received, not yet linked to a sale.
          </p>
          <div className="mt-4 space-y-2">
            {convertible.map((p) => {
              const vehicle = Array.isArray(p.vehicle) ? p.vehicle[0] : p.vehicle;
              const title = vehicle
                ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                : "Vehicle";
              const price = p.vehicle_price_usd ?? vehicle?.price ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--platform-border)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--platform-text)]">
                      {p.name} · {title}
                    </p>
                    <p className="text-xs text-[var(--platform-text-secondary)]">
                      {formatPrice(price)} · {p.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConvertTarget(p)}
                    className="platform-btn-primary shrink-0"
                  >
                    <FileText className="size-4" />
                    Convert to sale
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={createQuotation} className="platform-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">New quotation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs text-[var(--platform-text-secondary)]">Vehicle</span>
              <select
                required
                className="platform-select w-full"
                value={vehicleId}
                onChange={(e) => onVehicleChange(e.target.value)}
              >
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model} — {formatPrice(v.price)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Customer name</span>
              <input
                required
                className="platform-input w-full"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Customer email</span>
              <input
                required
                type="email"
                className="platform-input w-full"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Sale price</span>
              <input
                required
                type="number"
                min="1"
                className="platform-input w-full"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">Valid until</span>
              <input
                required
                type="date"
                className="platform-input platform-input--date w-full"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs text-[var(--platform-text-secondary)]">Notes</span>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="platform-btn-primary">
              {saving ? "Saving…" : "Create draft"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="platform-btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sale date</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {activeSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    No sales or quotations yet. Create one above or convert a pre-order.
                  </td>
                </tr>
              ) : (
                activeSales.map((sale) => (
                  <tr key={sale.id} className="border-t border-[var(--platform-border)]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sale.customer_name ?? "—"}</p>
                      {sale.customer_email && (
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          {sale.customer_email}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                      {vehicleLabel(sale.vehicle)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatPrice(sale.sale_price)}</td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                      {sale.valid_until ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {sale.status === "completed" ? (
                        <SaleStatusBadge status={sale.status} />
                      ) : (
                        <select
                          className="platform-select"
                          value={sale.status}
                          onChange={(e) => onStatusChange(sale, e.target.value)}
                        >
                          {SALE_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                            <option key={s} value={s}>
                              {saleStatusLabel(s)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                      <PlatformDateTime value={sale.sale_date ?? sale.created_at} className="text-xs" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sale.preorder_inquiry_id && sale.status !== "cancelled" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setRevertTarget(sale)}
                            className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-warning)]"
                            title="Revert to pre-order"
                          >
                            <RotateCcw className="size-4" />
                          </button>
                        )}
                        {sale.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => removeSale(sale.id)}
                            className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                            aria-label="Delete sale"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {convertTarget && (
        <ConfirmDialog
          open={!!convertTarget}
          onOpenChange={(open) => {
            if (!open) setConvertTarget(null);
          }}
          title="Convert pre-order to sale?"
          description={(() => {
            const vehicle = Array.isArray(convertTarget.vehicle)
              ? convertTarget.vehicle[0]
              : convertTarget.vehicle;
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
              : "Vehicle";
            const down = convertTarget.down_payment_usd ?? 0;
            return `Vehicle: ${title}\nCustomer: ${convertTarget.name}\nDown payment: ${formatPrice(down)}\n\nThis will create a sales record. You can revert if this was a mistake.`;
          })()}
          confirmLabel="Confirm convert"
          onConfirm={() => convertPreorder(convertTarget.id)}
        />
      )}

      {completeTarget && (
        <ConfirmDialog
          open={!!completeTarget}
          onOpenChange={(open) => {
            if (!open) setCompleteTarget(null);
          }}
          title="Mark sale as completed?"
          description={`Vehicle will be marked as sold.\n\nCustomer: ${completeTarget.customer_name ?? "—"}\nVehicle: ${vehicleLabel(completeTarget.vehicle)}`}
          confirmLabel="Mark completed"
          onConfirm={() => updateStatus(completeTarget.id, "completed")}
        />
      )}

      {revertTarget && (
        <ConfirmDialog
          open={!!revertTarget}
          onOpenChange={(open) => {
            if (!open) setRevertTarget(null);
          }}
          title="Revert this sale back to pre-order?"
          description={`This will cancel the sale for ${vehicleLabel(revertTarget.vehicle)} and restore the linked pre-order. Down payment status will be kept if payment was received.`}
          confirmLabel="Revert to pre-order"
          destructive
          onConfirm={() => revertSale(revertTarget.id)}
        />
      )}
    </div>
  );
}
