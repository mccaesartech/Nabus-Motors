"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Mail, MessageSquare, Phone, Trash2, User } from "lucide-react";
import { WhatsAppAssistAction } from "@/components/platform/whatsapp-assist-dialog";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import {
  PlatformPrintButton,
  PrintableRecord,
  PrintField,
  PrintSection,
} from "@/components/platform/printable-record";
import { buildInquiryDocumentHtml } from "@/lib/platform/printable-documents";
import { StatusBadge } from "@/components/platform/status-badge";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { formatPlatformDateTime } from "@/lib/platform/datetime";
import {
  inquiryDetailTitle,
  leadsListBackHref,
  vehicleInquiryTypeLabel,
  type InquiryDetailType,
} from "@/lib/platform/lead-detail";
import { customerProfileIdForOrder } from "@/lib/platform/order-profile";
import { platformPath } from "@/lib/platform/paths";
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS } from "@/lib/platform/types";

type InquiryRecord = Record<string, unknown>;

function str(value: unknown): string {
  if (value == null || value === "") return "";
  return String(value);
}

function displayName(record: InquiryRecord, type: InquiryDetailType): string {
  if (type === "finance") {
    return `${str(record.first_name)} ${str(record.last_name)}`.trim() || "Unknown";
  }
  if (type === "appraisal") return str(record.seller_name) || "Unknown";
  return str(record.name) || "Unknown";
}

function displayEmail(record: InquiryRecord, type: InquiryDetailType): string {
  if (type === "appraisal") return "";
  return str(record.email);
}

function displayPhone(record: InquiryRecord, type: InquiryDetailType): string {
  if (type === "appraisal") return str(record.seller_phone);
  return str(record.phone);
}

function inquiryReference(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

type LeadInquiryDetailProps = {
  type: InquiryDetailType;
  id: string;
};

export function LeadInquiryDetail({ type, id }: LeadInquiryDetailProps) {
  const router = useRouter();
  const [inquiry, setInquiry] = useState<InquiryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return;
      }
      setInquiry(null);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const row = json.inquiry as InquiryRecord;
    setInquiry(row);
    setNotes(str(row.follow_up_notes));
    setLoading(false);
  }, [id, router, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = inquiry ? displayName(inquiry, type) : "";
  const email = inquiry ? displayEmail(inquiry, type) : "";
  const phone = inquiry ? displayPhone(inquiry, type) : "";
  const createdAt = inquiry ? str(inquiry.created_at) : "";
  const status = inquiry ? str(inquiry.status) || "new" : "new";
  const source = inquiry ? str(inquiry.source) || "website" : "website";
  const userId = inquiry?.user_id ? str(inquiry.user_id) : null;

  const customerProfileHref = useMemo(() => {
    if (!inquiry) return platformPath("customers");
    if (type === "appraisal") {
      const key = phone ? `phone:${phone.replace(/\D/g, "")}` : id;
      return platformPath(`customers/${encodeURIComponent(key)}`);
    }
    return platformPath(
      `customers/${encodeURIComponent(
        customerProfileIdForOrder({ userId, email: email || `inquiry:${id}` })
      )}`
    );
  }, [email, id, inquiry, phone, type, userId]);

  const messageHref = useMemo(() => {
    if (!inquiry) return platformPath("messages");
    const params = new URLSearchParams();
    if (userId) params.set("user", userId);
    else if (email) params.set("email", email);
    if (name) params.set("name", name);
    if (phone) params.set("phone", phone);
    params.set(
      "subject",
      `${inquiryDetailTitle(type)} ${inquiryReference(id)}`
    );
    params.set("draft", `Hi ${name}, following up on your ${inquiryDetailTitle(type).toLowerCase()}. `);
    return `/platform/messages?${params.toString()}`;
  }, [email, id, inquiry, name, phone, type, userId]);

  async function updateField(updates: {
    status?: string;
    source?: string;
    follow_up_notes?: string;
  }) {
    if (!inquiry) return;
    setSaving(true);
    await fetch("/api/admin/inquiries/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, ...updates }),
    });
    setSaving(false);
    void load();
  }

  async function handleDelete() {
    const res = await fetch(
      `/api/admin/inquiries?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      router.push(leadsListBackHref(type));
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading inquiry…</p>;
  }

  if (!inquiry) {
    return (
      <PageHeader
        title="Inquiry not found"
        breadcrumb="Leads"
        backFallbackHref={leadsListBackHref(type)}
        backLabel="Back to leads"
      />
    );
  }

  const followUpIntro = `Hi ${name}, following up on your ${inquiryDetailTitle(type).toLowerCase()}.`;
  const title = inquiryDetailTitle(type);
  const ref = inquiryReference(id);

  return (
    <PrintableRecord
      title={title}
      subtitle={`Submitted ${formatPlatformDateTime(createdAt)}`}
      reference={ref}
    >
      <div className="space-y-6">
        <section className="platform-card no-print rounded-xl border border-[var(--platform-accent)]/20 bg-[rgba(139,92,246,0.04)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-accent)]">
            Follow up
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(email || userId) && (
              <Link href={messageHref} className="platform-btn-primary inline-flex items-center gap-2">
                <MessageSquare className="size-4" />
                Message customer
              </Link>
            )}
            {phone ? (
              <WhatsAppAssistAction
                phone={phone}
                customerName={name}
                context={{
                  type: "inquiry",
                  id,
                  inquiryType: type,
                  userId: userId ?? undefined,
                  email: email || undefined,
                }}
                variant="button"
              />
            ) : null}
            <Link href={customerProfileHref} className="platform-btn-ghost inline-flex items-center gap-2">
              <User className="size-4" />
              Customer profile
            </Link>
          </div>
        </section>

        <PageHeader
          title={title}
          description={`Submitted ${formatPlatformDateTime(createdAt)} · Ref ${ref}`}
          breadcrumb="Leads"
          backFallbackHref={leadsListBackHref(type)}
          backLabel="Back to leads"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PlatformPrintButton
                getHtml={() => buildInquiryDocumentHtml(type, id, inquiry)}
                downloadFilename={`true-goshen-${type}-${ref}.pdf`}
              />
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="platform-btn-ghost text-[var(--platform-error)]"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <PrintSection title="Customer">
            <div className="space-y-4 text-sm">
              <PrintField label="Name" value={name} />
              {email ? (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
                  <div>
                    <p className="text-xs text-[var(--platform-text-secondary)]">Email</p>
                    <a
                      href={`mailto:${email}`}
                      className="font-medium text-[var(--platform-accent)] hover:underline"
                    >
                      {email}
                    </a>
                  </div>
                </div>
              ) : null}
              {phone ? (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
                  <div>
                    <p className="text-xs text-[var(--platform-text-secondary)]">Phone</p>
                    <a
                      href={`tel:${phone}`}
                      className="font-medium text-[var(--platform-accent)] hover:underline"
                    >
                      {phone}
                    </a>
                  </div>
                </div>
              ) : null}
              <PrintField label="Inquiry ID" value={<span className="font-mono">{id}</span>} />
              <PrintField
                label="Submitted"
                value={formatPlatformDateTime(createdAt)}
              />
            </div>
          </PrintSection>

          <section className="platform-card rounded-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
              Request details
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              {type === "contact" && (
                <>
                  {str(inquiry.subject) && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Subject</dt>
                      <dd className="mt-0.5 font-medium">{str(inquiry.subject)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Message</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--platform-text)]">
                      {str(inquiry.message) || "—"}
                    </dd>
                  </div>
                </>
              )}

              {type === "vehicle" && (
                <>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Inquiry type</dt>
                    <dd className="mt-0.5 font-medium">
                      {vehicleInquiryTypeLabel(str(inquiry.inquiry_type))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Vehicle</dt>
                    <dd className="mt-0.5 font-medium">
                      {str(inquiry.vehicle_name) || str(inquiry.vehicle_slug) || "—"}
                    </dd>
                  </div>
                  {str(inquiry.vehicle_slug) && (
                    <div>
                      <Link
                        href={`/auto/inventory/${encodeURIComponent(str(inquiry.vehicle_slug))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                      >
                        View on site
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  )}
                  {str(inquiry.message) && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Message</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-[var(--platform-text)]">
                        {str(inquiry.message)}
                      </dd>
                    </div>
                  )}
                </>
              )}

              {type === "finance" && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Annual income</dt>
                      <dd className="mt-0.5 font-medium">
                        {str(inquiry.annual_income_range) || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Credit score</dt>
                      <dd className="mt-0.5 font-medium">
                        {str(inquiry.credit_score_range) || "—"}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Vehicle of interest</dt>
                    <dd className="mt-0.5 font-medium">
                      {str(inquiry.vehicle_of_interest) || "—"}
                    </dd>
                  </div>
                  {str(inquiry.notes) && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Notes</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-[var(--platform-text)]">
                        {str(inquiry.notes)}
                      </dd>
                    </div>
                  )}
                </>
              )}

              {type === "appraisal" && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Year</dt>
                      <dd className="mt-0.5 font-medium">{str(inquiry.year) || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Make</dt>
                      <dd className="mt-0.5 font-medium">{str(inquiry.make) || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Model</dt>
                      <dd className="mt-0.5 font-medium">{str(inquiry.model) || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Mileage</dt>
                      <dd className="mt-0.5 font-medium">
                        {inquiry.mileage != null
                          ? `${Number(inquiry.mileage).toLocaleString()} km`
                          : "—"}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--platform-text-secondary)]">Condition</dt>
                    <dd className="mt-0.5 font-medium">{str(inquiry.condition) || "—"}</dd>
                  </div>
                  {str(inquiry.notes) && (
                    <div>
                      <dt className="text-xs text-[var(--platform-text-secondary)]">Notes</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-[var(--platform-text)]">
                        {str(inquiry.notes)}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </section>
        </div>

        <section className="platform-card no-print rounded-xl p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">Status</label>
              <select
                value={status}
                disabled={saving}
                onChange={(e) => void updateField({ status: e.target.value })}
                className="platform-select w-full"
              >
                {LEAD_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">Source</label>
              <select
                value={source}
                disabled={saving}
                onChange={(e) => void updateField({ source: e.target.value })}
                className="platform-select w-full"
              >
                {LEAD_SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving) void updateField({ follow_up_notes: notes });
            }}
          >
            <label className="mb-1 block text-xs text-[var(--platform-text-secondary)]">
              Follow-up notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm text-[var(--platform-text)]"
              placeholder="Internal notes about this inquiry…"
            />
            <button type="submit" disabled={saving} className="platform-btn-primary mt-3">
              {saving ? "Saving…" : "Save notes"}
            </button>
          </form>
        </section>

        <ConfirmDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          title="Delete inquiry?"
          description={`Permanently remove ${name}'s ${title.toLowerCase()}? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          confirmPhrase={DELETE_CONFIRM_PHRASE}
          onConfirm={handleDelete}
        />
      </div>
    </PrintableRecord>
  );
}
