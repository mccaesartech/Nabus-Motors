"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";

type PartCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export default function PartsCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/parts/categories");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setCategories(json.categories ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/parts/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      setName("");
      setDescription("");
      load();
    }
  }

  async function toggleActive(cat: PartCategory) {
    await fetch("/api/admin/parts/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, is_active: !cat.is_active }),
    });
    load();
  }

  async function removeCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    await fetch(`/api/admin/parts/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading categories…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parts Categories"
        description="Manage the spare parts taxonomy shown on the public catalogue."
        breadcrumb="AUTO PARTS · Categories"
        actions={
          <Link href={platformPath("parts/inventory")} className="platform-btn-ghost">
            Parts inventory
          </Link>
        }
      />

      <form onSubmit={addCategory} className="platform-card grid gap-4 rounded-xl p-5 sm:grid-cols-3">
        <input
          className="platform-input"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="platform-input"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="platform-btn-primary inline-flex items-center justify-center gap-2">
          <Plus className="size-4" />
          Add category
        </button>
      </form>

      <div className="platform-card overflow-hidden rounded-xl">
        <table className="platform-table w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-[var(--platform-text-secondary)]">{cat.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{cat.slug}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="platform-btn-ghost text-xs"
                    onClick={() => void toggleActive(cat)}
                  >
                    {cat.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="platform-btn-ghost text-[var(--platform-error)]"
                    onClick={() => void removeCategory(cat.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
