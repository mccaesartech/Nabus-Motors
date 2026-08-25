"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { CustomerVisibleNoteField } from "@/components/platform/customer-visible-note-field";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { canDirectMutate } from "@/lib/platform/mutation-approval";
import { platformPath } from "@/lib/platform/paths";
import { canUseCustomerNoteAi, type PlatformRole } from "@/lib/platform/permissions";
import {
  FREIGHT_QUOTE_STATUSES,
  FREIGHT_QUOTE_STATUS_LABELS,
  generateTrackingNumber,
} from "@/lib/platform/shipment";
import { formatCargoDisplay } from "@/lib/freight/cargo-options";
import { FreightQuoteDetailPanel } from "@/components/platform/freight-quote-detail-panel";
import type { FreightQuoteRow } from "@/lib/platform/freight-quote-display";
import type { NotificationFeedbackVariant } from "@/lib/notifications/notification-status";
import { useMarkNotificationsOnVisit } from "@/hooks/use-mark-notifications-read";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type FreightQuote = FreightQuoteRow;

export default function FreightQuotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = usePlatformSession();
  const canMutate = session ? canDirectMutate(session.role) : false;
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [canUseAi, setCanUseAi] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendToast, setResendToast] = useState<string | null>(null);
  const [resendToastVariant, setResendToastVariant] = useState<"success" | "warning" | "neutral">("success");
  const [deleteTarget, setDeleteTarget] = useState<FreightQuote | null>(null);

  useMarkNotificationsOnVisit({
    link: platformPath("freight/quotes"),
    type: "freight_quote",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/freight/quotes");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    if (!res.ok || json.ok === false) {
      setLoadError(json.message ?? "Could not load freight quotes.");
      setTableMissing(Boolean(json.tableMissing));
      setQuotes([]);
    } else {
      setLoadError(null);
      setTableMissing(false);
      setQuotes(json.quotes ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const highlight = searchParams.get("quote");
    if (highlight) {
      setExpandedId(highlight);
    }
  }, [searchParams]);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => res.json())
      .then((json) => {
        const role = json.user?.role as PlatformRole | undefined;
        setCanUseAi(Boolean(role && canUseCustomerNoteAi(role)));
      })
      .catch(() => setCanUseAi(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/admin/freight/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function convertToShipment(quote: FreightQuote) {
    if (quote.converted_shipment_id) {
      router.push(
        `${platformPath("freight/tracking")}?shipment=${encodeURIComponent(quote.converted_shipment_id)}`
      );
      return;
    }

    setConvertingId(quote.id);
    try {
      const res = await fetch("/api/admin/freight/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_type: "freight",
          reference_id: quote.id,
          user_id: quote.user_id ?? undefined,
          tracking_number: generateTrackingNumber(),
          customer_name: quote.name,
          customer_email: quote.email,
          origin_country: quote.origin_country,
          destination: quote.destination ?? "Ghana",
          status: "booked",
          initial_event: {
            title: "Freight booking confirmed",
            description:
              formatCargoDisplay(quote.cargo_description, quote.cargo_size) ??
              "Quote converted to active shipment.",
            is_customer_visible: true,
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.shipment?.id) {
        await load();
        router.push(
          `${platformPath("freight/tracking")}?shipment=${encodeURIComponent(json.shipment.id)}`
        );
      }
    } finally {
      setConvertingId(null);
    }
  }

  async function resendConfirmation(quote: FreightQuote) {
    setResendingId(quote.id);
    setResendToast(null);
    try {
      const res = await fetch("/api/admin/freight/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResendToastVariant("warning");
        setResendToast(json.message ?? "Could not resend confirmation.");
        return;
      }
      setResendToast(json.notificationMessage ?? `Confirmation resent — reference ${json.referenceCode}.`);
      setResendToastVariant((json.notificationVariant as NotificationFeedbackVariant) ?? "success");
      await load();
    } finally {
      setResendingId(null);
    }
  }

  async function deleteQuote(quote: FreightQuote) {
    await fetch(`/api/admin/freight/quotes?id=${encodeURIComponent(quote.id)}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading quotes…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freight Quote Requests"
        description="Review inbound freight quotes, respond to customers, and convert accepted quotes to shipments."
        breadcrumb="FREIGHT · Quotes"
        actions={
          <Link href={platformPath("freight/tracking")} className="platform-btn-ghost">
            <ExternalLink className="size-4" />
            Shipment tracking
          </Link>
        }
      />

      {resendToast && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            resendToastVariant === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text-secondary)]"
              : resendToastVariant === "neutral"
                ? "border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-secondary)]"
                : "border-emerald-500/40 bg-emerald-500/10 text-[var(--platform-text-secondary)]"
          }`}
        >
          {resendToast}
        </div>
      )}

      {(loadError || tableMissing) && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--platform-text-secondary)]"
        >
          {tableMissing ? (
            <>
              Freight quote requests are temporarily unavailable. Inbound quotes will show here once
              setup is complete.
            </>
          ) : (
            loadError
          )}
        </div>
      )}

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--platform-text-secondary)]">
                    No freight quote requests yet.
                  </td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <Fragment key={quote.id}>
                    <tr>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left hover:text-[var(--platform-accent)]"
                          onClick={() =>
                            setExpandedId((id) => (id === quote.id ? null : quote.id))
                          }
                        >
                          <p className="font-medium">{quote.name}</p>
                          <p className="text-xs text-[var(--platform-text-secondary)]">
                            {quote.email}
                            {quote.phone ? ` · ${quote.phone}` : ""}
                            {quote.reference_code ? ` · ${quote.reference_code}` : ""}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {quote.service_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {quote.origin_country ?? "—"} → {quote.destination ?? "Ghana"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {formatCargoDisplay(quote.cargo_description, quote.cargo_size) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="platform-select text-xs"
                          value={quote.status}
                          onChange={(e) => void updateStatus(quote.id, e.target.value)}
                        >
                          {FREIGHT_QUOTE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {FREIGHT_QUOTE_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={quote.created_at} className="text-xs" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {quote.converted_shipment_id ? (
                            <Link
                              href={`${platformPath("freight/tracking")}?shipment=${encodeURIComponent(quote.converted_shipment_id)}`}
                              className="platform-btn-primary inline-flex items-center gap-1.5 text-xs"
                            >
                              <ExternalLink className="size-3.5" />
                              View shipment
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="platform-btn-primary text-xs"
                              disabled={convertingId === quote.id}
                              onClick={() => void convertToShipment(quote)}
                            >
                              {convertingId === quote.id ? "Converting…" : "Convert to shipment"}
                            </button>
                          )}
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs"
                            disabled={resendingId === quote.id}
                            onClick={() => void resendConfirmation(quote)}
                          >
                            {resendingId === quote.id ? "Sending…" : "Resend confirmation"}
                          </button>
                          {canMutate ? (
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs text-[var(--platform-error)]"
                            onClick={() => setDeleteTarget(quote)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {expandedId === quote.id && (
                      <tr>
                        <td colSpan={7} className="bg-[rgba(37,99,235,0.04)] px-4 py-4 text-sm">
                          <FreightQuoteDetailPanel quote={quote} />
                          <div className="mt-4 max-w-xl">
                            <CustomerVisibleNoteField
                              label="Draft reply to customer (copy into email)"
                              value={replyDrafts[quote.id] ?? ""}
                              onChange={(text) =>
                                setReplyDrafts((prev) => ({ ...prev, [quote.id]: text }))
                              }
                              rows={4}
                              placeholder="Professional reply acknowledging their quote request…"
                              compactHelp
                              showAi={canUseAi}
                              aiContext={{
                                fieldType: "freight_quote_reply",
                                customerName: quote.name,
                                originCountry: quote.origin_country ?? undefined,
                                destination: quote.destination ?? undefined,
                                serviceType: quote.service_type,
                                cargoDescription:
                                  formatCargoDisplay(
                                    quote.cargo_description,
                                    quote.cargo_size
                                  ) ?? undefined,
                                customerMessage: quote.message ?? undefined,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete quote request?"
        description={
          deleteTarget
            ? `Permanently delete the freight quote from ${deleteTarget.name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await deleteQuote(deleteTarget);
        }}
      />
    </div>
  );
}
