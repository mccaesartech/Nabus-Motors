"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { PlatformPrintButton } from "@/components/platform/printable-record";
import { PageHeader } from "@/components/platform/page-header";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { canDirectMutate } from "@/lib/platform/mutation-approval";
import { DOCUMENT_TYPES, type DocumentRow } from "@/lib/platform/modules";
import {
  buildDocumentHtml,
  documentDownloadFilename,
} from "@/lib/platform/document-templates";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type VehicleOption = {
  id: string;
  year: number;
  make: string;
  model: string;
  slug: string;
  price: number;
};

export default function DocumentsPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canMutate = session ? canDirectMutate(session.role) : false;
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState("sales_agreement");
  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/documents");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setDocuments(json.documents ?? []);
    setVehicles(json.vehicles ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId]
  );

  const documentInput = useMemo(() => {
    if (!selectedVehicle) return null;
    return {
      docType,
      customerName: customerName || "Customer",
      vehicleLabel: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`,
      vehiclePrice: selectedVehicle.price,
    };
  }, [docType, customerName, selectedVehicle]);

  async function saveDocumentLink(e: React.FormEvent) {
    e.preventDefault();
    const label = DOCUMENT_TYPES.find((d) => d.id === docType)?.label ?? "Document";
    const title = `${label} — ${customerName || selectedVehicle?.make || "Record"}`;
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        doc_type: docType,
        url: docUrl || null,
        vehicle_id: vehicleId || null,
        customer_name: customerName || null,
      }),
    });
    if (res.ok) {
      setDocUrl("");
      setToast("Document saved to library.");
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
        title="Documents"
        description="Generate printable agreements and manage your document library."
        breadcrumb="Documents"
      />

      {toast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]">
          {toast}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="platform-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Generate document</h2>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Document type</span>
            <select
              className="platform-select w-full"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Vehicle</span>
            <select
              className="platform-select w-full"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Customer name</span>
            <input
              className="platform-input w-full"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Mensah"
            />
          </label>
          {documentInput ? (
            <PlatformPrintButton
              label="Print"
              className="w-full"
              getHtml={() => buildDocumentHtml(documentInput)}
              downloadFilename={documentDownloadFilename(documentInput)}
            />
          ) : (
            <p className="text-sm text-[var(--platform-text-secondary)]">
              Select a vehicle to generate a printable document.
            </p>
          )}
        </div>

        <form onSubmit={saveDocumentLink} className="platform-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Save document link</h2>
          <p className="text-sm text-[var(--platform-text-secondary)]">
            {canMutate
              ? "Store an external URL (Google Drive, signed PDF, etc.) in the document library."
              : "Saving document links requires Owner or Super Admin approval."}
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Document URL</span>
            <input
              className="platform-input w-full"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://..."
              disabled={!canMutate}
            />
          </label>
          <button type="submit" className="platform-btn-ghost w-full" disabled={!canMutate}>
            <Plus className="size-4" />
            Save to library
          </button>
        </form>
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="border-b border-[var(--platform-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Document library</h2>
        </div>
        <div className="scroll-touch overflow-x-auto">
        <table className="platform-table w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--platform-text-secondary)]">
                  <FileText className="mx-auto mb-2 size-8 opacity-40" />
                  No documents saved yet.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 font-medium">{doc.title}</td>
                  <td className="px-4 py-3 text-[var(--platform-text-secondary)]">{doc.doc_type}</td>
                  <td className="px-4 py-3">{doc.customer_name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                    <PlatformDateTime value={doc.created_at} mode="date" className="text-xs" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--platform-accent)] hover:underline"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                      {canMutate ? (
                      <button
                        type="button"
                        onClick={() => removeDocument(doc.id)}
                        className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                        aria-label="Delete document"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
