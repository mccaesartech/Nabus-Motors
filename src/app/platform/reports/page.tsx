"use client";

import { useState } from "react";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { canExportInventory, canViewFinance } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const session = usePlatformSession();
  const showFinance = session ? canViewFinance(session.role) : false;
  const showInventoryExport = session ? canExportInventory(session.role) : false;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleExport(type: "inventory" | "leads" | "preorders" | "sales") {
    setExporting(type);
    setToast(null);
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`/api/admin/reports/export?${params.toString()}`);
      const body = await res.text();

      if (!res.ok) {
        let message = `Export failed (${res.status})`;
        try {
          const json = JSON.parse(body) as { message?: string };
          if (json.message) message = json.message;
        } catch {
          if (body.trim()) message = body.trim();
        }
        setToast({ ok: false, text: message });
        return;
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `true-goshen-${type}.csv`;
      const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ ok: true, text: `Downloaded ${filename}` });
    } catch {
      setToast({
        ok: false,
        text: "Could not reach the export service. Check your connection and try again.",
      });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Export inventory, leads, and pre-orders with optional date filters."
        breadcrumb="Reports"
      />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm",
            toast.ok
              ? "border-emerald-600/40 bg-emerald-50 text-emerald-900"
              : "border-red-600/40 bg-red-50 text-red-900"
          )}
        >
          {toast.ok ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden />
          ) : (
            <XCircle className="size-5 shrink-0 text-red-700" aria-hidden />
          )}
          {toast.text}
        </div>
      ) : null}

      <div className="platform-card rounded-xl p-6">
        <h2 className="text-sm font-semibold text-[var(--platform-text)]">Date range filter</h2>
        <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
          Leave blank to export all records. Filters apply to created date.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-md">
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">From</span>
            <input
              type="date"
              className="platform-input platform-input--date w-full"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">To</span>
            <input
              type="date"
              className="platform-input platform-input--date w-full"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ...(showInventoryExport
              ? [
                  {
                    type: "inventory" as const,
                    label: "Export Inventory CSV",
                    desc: "All vehicles in stock",
                  },
                ]
              : []),
            {
              type: "leads" as const,
              label: "Export Leads CSV",
              desc: "Contact, vehicle, finance, appraisal, pre-order",
            },
            {
              type: "preorders" as const,
              label: "Export Pre-orders CSV",
              desc: "Pre-order inquiries with payment status",
            },
            ...(showFinance
              ? [
                  {
                    type: "sales" as const,
                    label: "Export Sales CSV",
                    desc: "Quotations and completed sales",
                  },
                ]
              : []),
          ] as const
        ).map((item) => (
          <div key={item.type} className="platform-card flex flex-col rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--platform-text)]">{item.label}</h3>
            <p className="mt-2 flex-1 text-sm text-[var(--platform-text-secondary)]">{item.desc}</p>
            <button
              type="button"
              onClick={() => handleExport(item.type)}
              disabled={exporting === item.type}
              className="platform-btn-primary mt-4"
            >
              <Download className="size-4" />
              {exporting === item.type ? "Exporting…" : "Download"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
