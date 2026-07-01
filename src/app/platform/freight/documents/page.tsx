"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import { DOCUMENT_TYPES, type DocumentRow } from "@/lib/platform/modules";

const FREIGHT_DOC_TYPES = [
  { id: "bol", label: "Bill of Lading (BOL)" },
  { id: "customs_declaration", label: "Customs Declaration" },
  { id: "freight_invoice", label: "Freight Invoice" },
  ...DOCUMENT_TYPES,
];

export default function FreightDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState("bol");
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/documents");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    const freightDocs = (json.documents ?? []).filter((d: DocumentRow) =>
      ["bol", "customs_declaration", "freight_invoice", "invoice"].includes(d.doc_type)
    );
    setDocuments(freightDocs);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault();
    const label = FREIGHT_DOC_TYPES.find((d) => d.id === docType)?.label ?? "Document";
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || `${label} — ${customerName || "Freight record"}`,
        doc_type: docType,
        url: docUrl || null,
        customer_name: customerName || null,
      }),
    });
    if (res.ok) {
      setTitle("");
      setCustomerName("");
      setDocUrl("");
      load();
    }
  }

  async function removeDocument(id: string) {
    await fetch(`/api/admin/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading documents…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freight Documents"
        description="Store BOL, customs paperwork, and freight invoices linked to shipments."
        breadcrumb="FREIGHT · Documents"
        actions={
          <Link href={platformPath("freight/tracking")} className="platform-btn-ghost">
            <ExternalLink className="size-4" />
            Shipment tracking
          </Link>
        }
      />

      <form onSubmit={saveDocument} className="platform-card grid gap-4 rounded-xl p-5 lg:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--platform-text-secondary)]">Document type</span>
          <select
            className="platform-select w-full"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {FREIGHT_DOC_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--platform-text-secondary)]">Title</span>
          <input
            className="platform-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional — auto-generated if blank"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--platform-text-secondary)]">Customer / shipment ref</span>
          <input
            className="platform-input w-full"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name or tracking number"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--platform-text-secondary)]">File URL</span>
          <input
            className="platform-input w-full"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="lg:col-span-2">
          <button type="submit" className="platform-btn-primary inline-flex items-center gap-2">
            <Plus className="size-4" />
            Save document
          </button>
        </div>
      </form>

      <div className="platform-card overflow-hidden rounded-xl">
        <table className="platform-table w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Link</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--platform-text-secondary)]">
                  No freight documents saved yet.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 font-medium">{doc.title}</td>
                  <td className="px-4 py-3 text-xs capitalize">{doc.doc_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-xs">{doc.customer_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--platform-accent)] hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="platform-btn-ghost text-[var(--platform-error)]"
                      onClick={() => void removeDocument(doc.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
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
