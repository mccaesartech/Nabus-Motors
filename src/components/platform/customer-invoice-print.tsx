"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { usePrintablePdf } from "@/hooks/use-printable-pdf";
import {
  beginPrintSession,
  downloadPrintableDocument,
  printPrintableDocument,
} from "@/lib/print/document-shell";
import {
  fetchCustomerForPrint,
  fetchOrderForPrint,
  fetchPreorderForPrint,
  getCachedCustomerForPrint,
  getCachedOrderForPrint,
  getCachedPreorderForPrint,
  prewarmCustomerForPrint,
  prewarmOrderForPrint,
  prewarmPreorderForPrint,
  seedCachedCustomer,
} from "@/lib/print/pdf-cache";
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
    customer ?? getCachedCustomerForPrint(customerId)
  );
  const [fetching, setFetching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (customer?.id === customerId) {
      setResolvedCustomer(customer);
      seedCachedCustomer(customer);
    }
  }, [customer, customerId]);

  const activeCustomer =
    resolvedCustomer?.id === customerId
      ? resolvedCustomer
      : customer?.id === customerId
        ? customer
        : getCachedCustomerForPrint(customerId);

  const getHtml = useCallback(() => {
    if (!activeCustomer) {
      throw new Error("Customer not loaded");
    }
    return buildCustomerInvoiceDocumentHtml(activeCustomer);
  }, [activeCustomer]);

  const downloadFilename = activeCustomer
    ? invoiceFilename(activeCustomer)
    : `invoice-${customerId.slice(0, 8)}.pdf`;

  const pdf = usePrintablePdf(getHtml, downloadFilename, { autoPrewarm: false });

  const ensureCustomer = useCallback(async (): Promise<AdminCustomerDetail> => {
    if (activeCustomer) return activeCustomer;

    setFetching(true);
    try {
      const detail = await fetchCustomerForPrint(customerId);
      setResolvedCustomer(detail);
      return detail;
    } finally {
      setFetching(false);
    }
  }, [activeCustomer, customerId]);

  function handlePrewarm() {
    if (activeCustomer) return;
    prewarmCustomerForPrint(customerId);
  }

  function handlePrint() {
    setActionError(null);

    if (activeCustomer) {
      const result = printPrintableDocument(
        buildCustomerInvoiceDocumentHtml(activeCustomer)
      );
      if (!result.ok) setActionError(result.error);
      return;
    }

    const session = beginPrintSession();
    if (!session.ok) {
      setActionError(session.error);
      return;
    }

    setFetching(true);
    void fetchCustomerForPrint(customerId)
      .then((detail) => {
        setResolvedCustomer(detail);
        const result = session.complete(buildCustomerInvoiceDocumentHtml(detail));
        if (!result.ok) setActionError(result.error);
      })
      .catch((error) => {
        session.cancel();
        setActionError(
          error instanceof Error ? error.message : "Print failed. Allow popups or try Download."
        );
      })
      .finally(() => setFetching(false));
  }

  async function handleDownload() {
    setActionError(null);
    try {
      if (!activeCustomer) await ensureCustomer();
      const result = await pdf.download();
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      const cached = activeCustomer ?? getCachedCustomerForPrint(customerId);
      if (cached) {
        const result = await downloadPrintableDocument(
          buildCustomerInvoiceDocumentHtml(cached),
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
          onMouseEnter={handlePrewarm}
          onFocus={handlePrewarm}
          disabled={fetching}
          className={cn(
            "inline-flex items-center gap-2",
            compact ? "text-xs text-[var(--platform-accent)] hover:underline" : "platform-btn-ghost"
          )}
        >
          <Printer className={compact ? "size-3.5" : "size-4"} />
          {fetching ? "Loading…" : label}
        </button>
        {!compact ? (
          <button
            type="button"
            onClick={() => void handleDownload()}
            onMouseEnter={() => {
              handlePrewarm();
              if (activeCustomer) pdf.prewarm();
            }}
            onFocus={() => {
              handlePrewarm();
              if (activeCustomer) pdf.prewarm();
            }}
            disabled={fetching}
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
  order?: AdminOrderDetail | null;
  label?: string;
  className?: string;
};

export function OrderInvoicePrintButton({
  orderId,
  order,
  label = "Print invoice",
  className,
}: OrderInvoicePrintButtonProps) {
  const [fetching, setFetching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cachedOrder =
    order?.id === orderId ? order : getCachedOrderForPrint(orderId);

  const ensureOrder = useCallback(async (): Promise<AdminOrderDetail> => {
    if (cachedOrder) return cachedOrder;

    setFetching(true);
    try {
      return await fetchOrderForPrint(orderId);
    } finally {
      setFetching(false);
    }
  }, [cachedOrder, orderId]);

  function handlePrewarm() {
    if (!cachedOrder) prewarmOrderForPrint(orderId);
  }

  function handlePrint() {
    setActionError(null);

    if (cachedOrder) {
      const result = printPrintableDocument(buildAdminOrderDocumentHtml(cachedOrder));
      if (!result.ok) setActionError(result.error);
      return;
    }

    const session = beginPrintSession();
    if (!session.ok) {
      setActionError(session.error);
      return;
    }

    setFetching(true);
    void fetchOrderForPrint(orderId)
      .then((detail) => {
        const result = session.complete(buildAdminOrderDocumentHtml(detail));
        if (!result.ok) setActionError(result.error);
      })
      .catch((error) => {
        session.cancel();
        setActionError(error instanceof Error ? error.message : "Print failed.");
      })
      .finally(() => setFetching(false));
  }

  async function handleDownload() {
    setActionError(null);
    try {
      const detail = cachedOrder ?? (await ensureOrder());
      const ref = detail.id.slice(0, 8).toUpperCase();
      const result = await downloadPrintableDocument(
        buildAdminOrderDocumentHtml(detail),
        `order-${ref}.pdf`
      );
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Download failed.");
    }
  }

  return (
    <div className={cn("no-print inline-flex flex-col items-start gap-1", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePrint()}
          onMouseEnter={handlePrewarm}
          onFocus={handlePrewarm}
          disabled={fetching}
          className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
        >
          <Printer className="size-3.5" />
          {fetching ? "Loading…" : label}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload()}
          onMouseEnter={handlePrewarm}
          onFocus={handlePrewarm}
          disabled={fetching}
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
  preorder?: PreorderInquiryRow | null;
  label?: string;
  className?: string;
};

export function PreorderInvoicePrintButton({
  preorderId,
  preorder,
  label = "Print invoice",
  className,
}: PreorderInvoicePrintButtonProps) {
  const [fetching, setFetching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cachedPreorder =
    preorder?.id === preorderId ? preorder : getCachedPreorderForPrint(preorderId);

  const ensurePreorder = useCallback(async (): Promise<PreorderInquiryRow> => {
    if (cachedPreorder) return cachedPreorder;

    setFetching(true);
    try {
      return await fetchPreorderForPrint(preorderId);
    } finally {
      setFetching(false);
    }
  }, [cachedPreorder, preorderId]);

  function handlePrewarm() {
    if (!cachedPreorder) prewarmPreorderForPrint(preorderId);
  }

  function handlePrint() {
    setActionError(null);

    if (cachedPreorder) {
      const result = printPrintableDocument(buildAdminPreorderDocumentHtml(cachedPreorder));
      if (!result.ok) setActionError(result.error);
      return;
    }

    const session = beginPrintSession();
    if (!session.ok) {
      setActionError(session.error);
      return;
    }

    setFetching(true);
    void fetchPreorderForPrint(preorderId)
      .then((detail) => {
        const result = session.complete(buildAdminPreorderDocumentHtml(detail));
        if (!result.ok) setActionError(result.error);
      })
      .catch((error) => {
        session.cancel();
        setActionError(error instanceof Error ? error.message : "Print failed.");
      })
      .finally(() => setFetching(false));
  }

  async function handleDownload() {
    setActionError(null);
    try {
      const inquiry = cachedPreorder ?? (await ensurePreorder());
      const isCustom = inquiry.is_custom_request === true;
      const ref = inquiry.reference_code ?? inquiry.id.slice(0, 8).toUpperCase();
      const result = await downloadPrintableDocument(
        buildAdminPreorderDocumentHtml(inquiry),
        `${isCustom ? "custom-request" : "preorder"}-${ref}.pdf`
      );
      if (!result.ok) setActionError(result.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Download failed.");
    }
  }

  return (
    <div className={cn("no-print inline-flex flex-col items-start gap-1", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePrint()}
          onMouseEnter={handlePrewarm}
          onFocus={handlePrewarm}
          disabled={fetching}
          className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
        >
          <Printer className="size-3.5" />
          {fetching ? "Loading…" : label}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload()}
          onMouseEnter={handlePrewarm}
          onFocus={handlePrewarm}
          disabled={fetching}
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
