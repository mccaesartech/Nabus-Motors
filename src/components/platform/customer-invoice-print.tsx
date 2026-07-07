"use client";

import { useCallback, useState } from "react";
import { Download, Printer } from "lucide-react";
import { usePrintablePdf } from "@/hooks/use-printable-pdf";
import {
  downloadPrintableDocument,
  printPrintableDocument,
} from "@/lib/print/document-shell";
import {
  buildAdminOrderDocumentHtml,
  buildAdminPreorderDocumentHtml,
  buildCustomerInvoiceDocumentHtml,
} from "@/lib/platform/printable-documents";
import type { AdminCustomerDetail } from "@/lib/platform/customers-admin";
import type { AdminOrderDetail } from "@/lib/platform/orders-admin";
import type { PreorderInquiryRow } from "@/lib/platform/preorder";
import { cn } from "@/lib/utils";

function invoiceFilename(customer: AdminCustomerDetail): string {
  return `invoice-${customer.registrationId ?? customer.id.slice(0, 8)}.pdf`;
}

type CustomerInvoicePrintButtonProps = {
  customerId: string;
  customer?: AdminCustomerDetail | null;
  label?: string;
  className?: string;
  compact?: boolean;
};

export function CustomerInvoicePrintButton({
  customerId,
  customer,
  label = "Print Invoice",
  className,
  compact = false,
}: CustomerInvoicePrintButtonProps) {
  const [resolvedCustomer, setResolvedCustomer] = useState<AdminCustomerDetail | null>(
    customer ?? null
  );
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const getHtml = useCallback(() => {
    if (!resolvedCustomer) {
      throw new Error("Customer not loaded");
    }
    return buildCustomerInvoiceDocumentHtml(resolvedCustomer);
  }, [resolvedCustomer]);

  const downloadFilename = resolvedCustomer
    ? invoiceFilename(resolvedCustomer)
    : `invoice-${customerId.slice(0, 8)}.pdf`;

  const pdf = usePrintablePdf(getHtml, downloadFilename, { autoPrewarm: false });

  const ensureCustomer = useCallback(async (): Promise<AdminCustomerDetail> => {
    if (resolvedCustomer && resolvedCustomer.id === customerId) {
      return resolvedCustomer;
    }
    if (customer && customer.id === customerId) {
      setResolvedCustomer(customer);
      return customer;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`);
      const json = await res.json();
      if (!res.ok || !json.customer) {
        throw new Error(json.message ?? "Could not load customer");
      }
      setResolvedCustomer(json.customer as AdminCustomerDetail);
      return json.customer as AdminCustomerDetail;
    } finally {
      setLoading(false);
    }
  }, [customer, customerId, resolvedCustomer]);

  async function handlePrint() {
    setActionError(null);
    try {
      const detail = await ensureCustomer();
      const result = printPrintableDocument(buildCustomerInvoiceDocumentHtml(detail));
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Print failed. Allow popups or try Download.");
    }
  }

  async function handleDownload() {
    setActionError(null);
    try {
      await ensureCustomer();
      const result = await pdf.download();
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      if (resolvedCustomer) {
        const result = await downloadPrintableDocument(
          buildCustomerInvoiceDocumentHtml(resolvedCustomer),
          downloadFilename
        );
        if (!result.ok) setActionError(result.error);
        return;
      }
      setActionError(error instanceof Error ? error.message : "Download failed.");
    }
  }

  return (
    <div className={cn("no-print inline-flex flex-col items-start gap-1", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2",
            compact ? "text-xs text-[var(--platform-accent)] hover:underline" : "platform-btn-ghost"
          )}
        >
          <Printer className={compact ? "size-3.5" : "size-4"} />
          {loading ? "Loading…" : label}
        </button>
        {!compact ? (
          <button
            type="button"
            onClick={() => void handleDownload()}
            onMouseEnter={() => {
              void ensureCustomer().then(() => pdf.prewarm());
            }}
            onFocus={() => {
              void ensureCustomer().then(() => pdf.prewarm());
            }}
            disabled={loading}
            aria-busy={pdf.generating && !pdf.ready}
            className={cn(
              "platform-btn-ghost inline-flex items-center gap-2",
              pdf.ready && "text-emerald-700"
            )}
          >
            <Download className="size-4" />
            {pdf.ready ? "Download" : pdf.generating ? "Preparing…" : "Download"}
          </button>
        ) : null}
      </div>
      {actionError ? (
        <p className="text-xs text-[var(--platform-error)]" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

type OrderInvoicePrintButtonProps = {
  orderId: string;
  label?: string;
  className?: string;
};

export function OrderInvoicePrintButton({
  orderId,
  label = "Print invoice",
  className,
}: OrderInvoicePrintButtonProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchOrder(): Promise<AdminOrderDetail> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
    const json = await res.json();
    if (!res.ok || !json.order) {
      throw new Error(json.message ?? "Could not load order");
    }
    return json.order as AdminOrderDetail;
  }

  async function handlePrint() {
    setActionError(null);
    setLoading(true);
    try {
      const order = await fetchOrder();
      const result = printPrintableDocument(buildAdminOrderDocumentHtml(order));
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Print failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setActionError(null);
    setLoading(true);
    try {
      const order = await fetchOrder();
      const ref = order.id.slice(0, 8).toUpperCase();
      const result = await downloadPrintableDocument(
        buildAdminOrderDocumentHtml(order),
        `order-${ref}.pdf`
      );
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("no-print inline-flex flex-col items-start gap-1", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
        >
          <Printer className="size-3.5" />
          {loading ? "Loading…" : label}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
        >
          <Download className="size-3.5" />
          PDF
        </button>
      </div>
      {actionError ? (
        <p className="text-xs text-[var(--platform-error)]" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

type PreorderInvoicePrintButtonProps = {
  preorderId: string;
  label?: string;
  className?: string;
};

export function PreorderInvoicePrintButton({
  preorderId,
  label = "Print invoice",
  className,
}: PreorderInvoicePrintButtonProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchPreorder(): Promise<PreorderInquiryRow> {
    const res = await fetch(`/api/admin/inquiries/preorder/${encodeURIComponent(preorderId)}`);
    const json = await res.json();
    if (!res.ok || !json.inquiry) {
      throw new Error(json.message ?? "Could not load pre-order");
    }
    return json.inquiry as PreorderInquiryRow;
  }

  async function handlePrint() {
    setActionError(null);
    setLoading(true);
    try {
      const inquiry = await fetchPreorder();
      const result = printPrintableDocument(buildAdminPreorderDocumentHtml(inquiry));
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Print failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setActionError(null);
    setLoading(true);
    try {
      const inquiry = await fetchPreorder();
      const isCustom = inquiry.is_custom_request === true;
      const ref = inquiry.reference_code ?? inquiry.id.slice(0, 8).toUpperCase();
      const result = await downloadPrintableDocument(
        buildAdminPreorderDocumentHtml(inquiry),
        `${isCustom ? "custom-request" : "preorder"}-${ref}.pdf`
      );
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("no-print inline-flex flex-col items-start gap-1", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
        >
          <Printer className="size-3.5" />
          {loading ? "Loading…" : label}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
        >
          <Download className="size-3.5" />
          PDF
        </button>
      </div>
      {actionError ? (
        <p className="text-xs text-[var(--platform-error)]" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
