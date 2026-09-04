"use client";

import { useState, type ReactNode } from "react";
import { Download, Printer } from "lucide-react";
import { usePrintablePdf } from "@/hooks/use-printable-pdf";
import {
  printPrintableDocument,
} from "@/lib/print/document-shell";
import {
  PRINT_LOGO_DATA_URL,
  PRINT_LOGO_HEIGHT,
  PRINT_LOGO_WIDTH,
  getPrintLogoUrl,
} from "@/lib/print/print-logo";
import { cn } from "@/lib/utils";

type PlatformPrintButtonProps = {
  label?: string;
  className?: string;
  getHtml: () => string;
  downloadFilename?: string;
  showDownload?: boolean;
};

export function PlatformPrintButton({
  label = "Print",
  className,
  getHtml,
  downloadFilename,
  showDownload = Boolean(downloadFilename),
}: PlatformPrintButtonProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const pdf = usePrintablePdf(getHtml, downloadFilename ?? "document.pdf");

  function handlePrint() {
    setActionError(null);
    try {
      const result = printPrintableDocument(getHtml());
      if (!result.ok) setActionError(result.error);
    } catch {
      setActionError("Print failed. Allow popups or try Download.");
    }
  }

  async function handleDownload() {
    if (!downloadFilename) return;
    setActionError(null);
    const result = await pdf.download();
    if (!result.ok) setActionError(result.error);
  }

  function handleDownloadHover() {
    pdf.prewarm();
  }

  return (
    <div className={cn("no-print inline-flex flex-col items-start gap-1", className)}>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="platform-btn-ghost inline-flex items-center gap-2"
        >
          <Printer className="size-4" />
          {label}
        </button>
        {showDownload && downloadFilename ? (
          <button
            type="button"
            onClick={handleDownload}
            onMouseEnter={handleDownloadHover}
            onFocus={handleDownloadHover}
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

type PrintableRecordProps = {
  title: string;
  subtitle?: string;
  reference?: string;
  children: ReactNode;
  className?: string;
};

export function PrintableRecord({
  title,
  subtitle,
  reference,
  children,
  className,
}: PrintableRecordProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [retriedUrl, setRetriedUrl] = useState(false);

  return (
    <div className={cn("platform-print-record", className)}>
      <header className="platform-print-header mb-3 hidden border-b border-[#6b21a8] pb-2 print:block">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={retriedUrl ? getPrintLogoUrl() : PRINT_LOGO_DATA_URL}
                alt="Nabus Motors"
                width={PRINT_LOGO_WIDTH}
                height={PRINT_LOGO_HEIGHT}
                className="h-8 w-auto max-w-[110px] object-contain"
                onError={() => {
                  if (!retriedUrl) {
                    setRetriedUrl(true);
                    return;
                  }
                  setLogoFailed(true);
                }}
              />
            ) : (
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-bold italic text-[#7c3aed]">TG</span>
                <span className="text-sm font-bold tracking-[0.14em] text-[#4c1d95]">
                  Nabus Motors
                </span>
                <span className="text-[9px] font-semibold tracking-[0.28em] text-[#9333ea]">
                  AUTO
                </span>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-[var(--platform-text)]">
                Nabus Motors and Trading
              </p>
              <p className="text-[10px] text-[var(--platform-text-secondary)]">
                Vehicles · Freight · Parts
              </p>
            </div>
          </div>
          {reference ? (
            <p className="text-right text-xs text-[var(--platform-text-secondary)]">
              Ref <span className="font-mono font-medium text-[var(--platform-text)]">{reference}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-2">
          <h1 className="text-sm font-semibold text-[var(--platform-text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}

type PrintFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function PrintField({ label, value, className }: PrintFieldProps) {
  return (
    <div className={className}>
      <p className="text-xs text-[var(--platform-text-secondary)]">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-[var(--platform-text)]">{value}</div>
    </div>
  );
}

type PrintSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function PrintSection({ title, children, className }: PrintSectionProps) {
  return (
    <section className={cn("platform-card overflow-hidden rounded-xl", className)}>
      <div className="border-b border-[var(--platform-border)] px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text)]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
