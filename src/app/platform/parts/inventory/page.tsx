"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";

type PartRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price_usd: number | null;
  stock_quantity: number;
  status: string;
  brand: string | null;
  category_id: string | null;
  parts_categories: { name: string } | null;
};

type CategoryOption = { id: string; name: string };

export default function PartsInventoryPage() {
  const router = useRouter();
  const [parts, setParts] = useState<PartRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    price_usd: "",
    stock_quantity: "0",
    category_id: "",
    brand: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<PartRow | null>(null);

  const load = useCallback(async () => {
    const [partsRes, catsRes] = await Promise.all([
      fetch("/api/admin/parts"),
      fetch("/api/admin/parts/categories"),
    ]);
    if (isAdminAuthError(partsRes)) {
      router.push(adminLoginPath());
      return;
    }
    const partsJson = await partsRes.json();
    const catsJson = await catsRes.json();
    setParts(partsJson.parts ?? []);
    setCategories(catsJson.categories ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sku: form.sku || null,
        price_usd: form.price_usd ? Number(form.price_usd) : null,
        stock_quantity: Number(form.stock_quantity) || 0,
        category_id: form.category_id || null,
        brand: form.brand || null,
        status: "draft",
      }),
    });
    if (res.ok) {
      setForm({ name: "", sku: "", price_usd: "", stock_quantity: "0", category_id: "", brand: "" });
      load();
    }
  }

  async function updatePart(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/parts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    load();
  }

  async function removePart(part: PartRow) {
    await fetch(`/api/admin/parts?id=${encodeURIComponent(part.id)}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading parts…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parts Inventory"
        description="Add and manage spare parts stock, SKUs, and pricing."
        breadcrumb="AUTO PARTS · Inventory"
        actions={
          <Link href={platformPath("parts/published")} className="platform-btn-ghost">
            Published catalogue
          </Link>
        }
      />

      <form onSubmit={addPart} className="platform-card grid gap-3 rounded-xl p-5 sm:grid-cols-2 lg:grid-cols-6">
        <input
          className="platform-input"
          placeholder="Part name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          className="platform-input"
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
        />
        <input
          className="platform-input"
          placeholder="Price USD"
          type="number"
          value={form.price_usd}
          onChange={(e) => setForm((f) => ({ ...f, price_usd: e.target.value }))}
        />
        <input
          className="platform-input"
          placeholder="Stock qty"
          type="number"
          value={form.stock_quantity}
          onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
        />
        <select
          className="platform-select"
          value={form.category_id}
          onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
        >
          <option value="">Category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="platform-btn-primary inline-flex items-center justify-center gap-2">
          <Plus className="size-4" />
          Add part
        </button>
      </form>

      <div className="platform-card overflow-hidden rounded-xl">
        <table className="platform-table w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Part</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.id}>
                <td className="px-4 py-3 font-medium">{part.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{part.sku ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{part.parts_categories?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {part.price_usd != null ? `$${part.price_usd}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    className="platform-input w-20 text-xs"
                    defaultValue={part.stock_quantity}
                    onBlur={(e) => {
                      const qty = Number(e.target.value);
                      if (qty !== part.stock_quantity) {
                        void updatePart(part.id, { stock_quantity: qty });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    className="platform-select text-xs"
                    value={part.status}
                    onChange={(e) => void updatePart(part.id, { status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="platform-btn-ghost text-[var(--platform-error)]"
                    onClick={() => setDeleteTarget(part)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete part?"
        description={
          deleteTarget
            ? `Permanently delete “${deleteTarget.name}” from parts inventory? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await removePart(deleteTarget);
        }}
      />
    </div>
  );
}
