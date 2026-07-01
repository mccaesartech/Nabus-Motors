"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/platform/page-header";
import { StatusBadge } from "@/components/platform/status-badge";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import { ROUTES } from "@/lib/routes";

type PartRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  stock_quantity: number;
  price_usd: number | null;
  is_featured: boolean;
};

export default function PartsPublishedPage() {
  const router = useRouter();
  const [parts, setParts] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/parts");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setParts(json.parts ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return parts;
    return parts.filter((p) => p.status === filter);
  }, [parts, filter]);

  async function updatePart(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/parts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading catalogue…</p>;
  }

  const publishedCount = parts.filter((p) => p.status === "published").length;
  const draftCount = parts.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draft & Published"
        description="Review catalogue workflow and publish parts to the public spare parts store."
        breadcrumb="AUTO PARTS · Published"
        actions={
          <>
            <a
              href={ROUTES.auto.spareParts}
              target="_blank"
              rel="noopener noreferrer"
              className="platform-btn-ghost"
            >
              View public catalogue
            </a>
            <Link href={platformPath("parts/inventory")} className="platform-btn-primary">
              Manage inventory
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={filter === "all" ? "platform-btn-primary" : "platform-btn-ghost"}
          onClick={() => setFilter("all")}
        >
          All ({parts.length})
        </button>
        <button
          type="button"
          className={filter === "published" ? "platform-btn-primary" : "platform-btn-ghost"}
          onClick={() => setFilter("published")}
        >
          Published ({publishedCount})
        </button>
        <button
          type="button"
          className={filter === "draft" ? "platform-btn-primary" : "platform-btn-ghost"}
          onClick={() => setFilter("draft")}
        >
          Draft ({draftCount})
        </button>
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        <table className="platform-table w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Part</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Featured</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--platform-text-secondary)]">
                  No parts in this view.
                </td>
              </tr>
            ) : (
              filtered.map((part) => (
                <tr key={part.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{part.name}</p>
                    <p className="font-mono text-xs text-[var(--platform-text-secondary)]">
                      {part.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={part.status} />
                  </td>
                  <td className="px-4 py-3">{part.stock_quantity}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="platform-btn-ghost text-xs"
                      onClick={() => void updatePart(part.id, { is_featured: !part.is_featured })}
                    >
                      {part.is_featured ? "Featured" : "Standard"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {part.status !== "published" ? (
                        <button
                          type="button"
                          className="platform-btn-primary text-xs"
                          onClick={() => void updatePart(part.id, { status: "published" })}
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="platform-btn-ghost text-xs"
                          onClick={() => void updatePart(part.id, { status: "draft" })}
                        >
                          Unpublish
                        </button>
                      )}
                      <a
                        href={ROUTES.auto.sparePartDetail(part.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="platform-btn-ghost text-xs"
                      >
                        Preview
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
