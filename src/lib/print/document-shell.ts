import {
  COMPANY_NAME,
  SITE_NAME,
} from "@/lib/constants";
import {
  getCachedPdfBlob,
  getOrGeneratePdfBlob,
  isPdfGenerationInFlight,
} from "@/lib/print/pdf-cache";
import {
  LETTERHEAD_DATA_URL,
  LETTERHEAD_PNG_PATH,
} from "@/lib/print/letterhead-data";
import { getAutoSiteUrl } from "@/lib/site-url";

/** Body safe zone (mm) tuned to True Goshen letterhead header/footer bands. */
export const LETTERHEAD_SAFE_ZONE = {
  topMm: 46,
  bottomMm: 42,
  leftMm: 16,
  rightMm: 16,
} as const;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getLetterheadAssetUrl(): string {
  return `${getAutoSiteUrl()}${LETTERHEAD_PNG_PATH}`;
}

function printLetterheadMarkup(): string {
  const src = escapeAttr(LETTERHEAD_DATA_URL);
  const urlFallback = escapeAttr(getLetterheadAssetUrl());

  return `
    <img
      class="letterhead-bg"
      src="${src}"
      data-fallback-src="${urlFallback}"
      alt=""
      aria-hidden="true"
      width="1240"
      height="1753"
      onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src=this.dataset.fallbackSrc;}"
    />
  `;
}

/** html2canvas scale — 1.0 prioritizes speed; text stays readable on A4. */
const PDF_CANVAS_SCALE = 1.0;
/** Max wait before opening print dialog even if images are still loading. */
const PRINT_DIALOG_MAX_WAIT_MS = 300;

export const PRINT_PAGE_WIDTH_PX = 794;

const LETTERHEAD_TOP_MM = LETTERHEAD_SAFE_ZONE.topMm;
const LETTERHEAD_BOTTOM_MM = LETTERHEAD_SAFE_ZONE.bottomMm;
const LETTERHEAD_LEFT_MM = LETTERHEAD_SAFE_ZONE.leftMm;
const LETTERHEAD_RIGHT_MM = LETTERHEAD_SAFE_ZONE.rightMm;
const PRINT_BODY_PADDING = `${LETTERHEAD_TOP_MM}mm ${LETTERHEAD_RIGHT_MM}mm ${LETTERHEAD_BOTTOM_MM}mm ${LETTERHEAD_LEFT_MM}mm`;

export const PRINT_STYLES = `
  * { box-sizing: border-box; }
  @page {
    margin: 0;
    size: A4;
  }
  html, body {
    overflow: visible !important;
    height: auto !important;
  }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    width: ${PRINT_PAGE_WIDTH_PX}px;
    max-width: ${PRINT_PAGE_WIDTH_PX}px;
    margin: 0 auto;
    padding: 0;
    color: #111;
    line-height: 1.35;
    font-size: 10pt;
    background: #fff;
  }
  body.document {
    position: relative;
    min-height: 297mm;
    padding: ${PRINT_BODY_PADDING};
    display: flex;
    flex-direction: column;
  }
  .letterhead-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 210mm;
    height: 297mm;
    object-fit: fill;
    z-index: 0;
    pointer-events: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .document-main {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
  }
  .no-break { page-break-inside: avoid; break-inside: avoid; }
  .doc-meta {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    margin-bottom: 6px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .doc-meta-spacer { flex: 1 1 auto; }
  .doc-meta-block { flex: 0 0 auto; text-align: right; }
  .doc-meta-type {
    margin: 0 0 2px;
    font-size: 13pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #1e3a8a;
    line-height: 1.1;
  }
  .doc-meta-ref {
    margin: 0;
    font-size: 9pt;
    color: #374151;
    line-height: 1.3;
  }
  .doc-meta-ref strong {
    font-family: ui-monospace, monospace;
    color: #111;
    font-weight: 600;
  }
  .doc-title { font-size: 14px; font-weight: 600; margin: 0 0 2px; color: #111; line-height: 1.2; }
  .doc-subtitle { font-size: 9pt; color: #555; margin: 0 0 10px; line-height: 1.3; }
  .section { margin-bottom: 12px; page-break-inside: auto; break-inside: auto; }
  .section-title {
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #374151;
    margin: 0 0 5px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e5e7eb;
    page-break-after: avoid;
    break-after: avoid;
  }
  .address-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }
  .address-col {
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }
  .address-label {
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
    margin: 0 0 5px;
  }
  .address-block { margin: 0; }
  .address-block dt { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; margin: 5px 0 0; }
  .address-block dt:first-child { margin-top: 0; }
  .address-block dd { margin: 1px 0 0; font-weight: 500; color: #111; font-size: 9pt; }
  .address-name { font-size: 10pt; font-weight: 600; }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 14px;
    margin-bottom: 0;
    padding: 8px 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .meta-grid dt { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; margin: 0; }
  .meta-grid dd { margin: 1px 0 0; font-weight: 500; color: #111; font-size: 9pt; }
  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .detail-table th,
  .detail-table td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  .detail-table th {
    width: 34%;
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #6b7280;
    background: #f9fafb;
    border-right: 1px solid #f3f4f6;
  }
  .detail-table td { color: #111; }
  .detail-table tr { page-break-inside: auto; break-inside: auto; }
  .message-block {
    margin-top: 0;
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    white-space: pre-wrap;
    font-size: 9pt;
    line-height: 1.4;
  }
  table.items {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-bottom: 0;
    font-size: 9pt;
  }
  table.items td:nth-child(2),
  table.items th:nth-child(2) {
    word-break: break-word;
  }
  table.items thead { display: table-header-group; }
  table.items th {
    text-align: left;
    padding: 5px 6px;
    border-bottom: 1.5px solid #1e3a8a;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #1e3a8a;
    background: #eff6ff;
    page-break-after: avoid;
    break-after: avoid;
  }
  table.items td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  table.items tbody tr { page-break-inside: auto; break-inside: auto; }
  table.items .num { text-align: right; white-space: nowrap; }
  .item-name { font-weight: 500; line-height: 1.25; }
  .item-detail { font-size: 8pt; color: #6b7280; margin-top: 1px; line-height: 1.2; }
  .item-thumb,
  .item-thumb-placeholder {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    background: #f3f4f6;
    display: block;
  }
  .item-thumb-placeholder { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); }
  .totals-box {
    margin: 8px 0 0 auto;
    width: min(100%, 280px);
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .totals-line {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 10px;
    font-size: 9pt;
    border-bottom: 1px solid #f3f4f6;
  }
  .totals-line:last-child { border-bottom: none; }
  .totals-line--grand {
    background: #eff6ff;
    border-top: 1.5px solid #1e3a8a;
    font-size: 10pt;
    font-weight: 700;
    color: #1e3a8a;
  }
  .payment-note {
    margin: 8px 0 0;
    padding: 6px 10px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    font-size: 8.5pt;
    color: #92400e;
    line-height: 1.35;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .empty-note {
    margin: 0;
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    font-size: 9pt;
    color: #6b7280;
  }
  .total-row {
    text-align: right;
    font-size: 10pt;
    font-weight: 600;
    padding: 8px 6px;
    border-top: 1.5px solid #1e3a8a;
    margin-top: 4px;
  }
  .footer {
    position: relative;
    z-index: 1;
    margin-top: auto;
    padding-top: 6px;
    font-size: 8.5pt;
    color: #4b5563;
    text-align: center;
    line-height: 1.35;
    flex-shrink: 0;
  }
  .footer p { margin: 0 0 3px; }
  .footer-thanks { color: #111; }
  .footer-terms {
    margin: 0;
    font-size: 7.5pt;
    color: #6b7280;
    line-height: 1.35;
  }
  .no-print { display: none !important; }
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    img {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { margin: 0; padding: ${PRINT_BODY_PADDING}; width: auto; max-width: none; font-size: 9.5pt; }
    body.document { min-height: 297mm; }
    .letterhead-bg {
      position: fixed;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
  }
`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return getAutoSiteUrl();
}

export function absoluteAssetUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${siteOrigin()}${url}`;
  return url;
}

export function formatPrintDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatPrintDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function brandHeader(reference?: string, docType?: string): string {
  const docTypeLine = docType
    ? `<p class="doc-meta-type">${escapeHtml(docType)}</p>`
    : "";
  const refLine = reference
    ? `<p class="doc-meta-ref">Ref <strong>${escapeHtml(reference)}</strong></p>`
    : "";

  if (!docTypeLine && !refLine) return "";

  return `
    <header class="doc-meta no-break">
      <div class="doc-meta-spacer" aria-hidden="true"></div>
      <div class="doc-meta-block">
        ${docTypeLine}
        ${refLine}
      </div>
    </header>
  `;
}

export function billToAndDetails(
  customer: { name: string; email: string; phone?: string | null },
  detailsHtml: string
): string {
  const phone = customer.phone?.trim()
    ? `<dt>Phone</dt><dd>${escapeHtml(customer.phone.trim())}</dd>`
    : "";

  return `
    <div class="address-row">
      <div class="address-col">
        <h3 class="address-label">Bill to</h3>
        <dl class="address-block">
          <dt>Name</dt>
          <dd class="address-name">${escapeHtml(customer.name)}</dd>
          <dt>Email</dt>
          <dd>${escapeHtml(customer.email)}</dd>
          ${phone}
        </dl>
      </div>
      <div class="address-col">
        <h3 class="address-label">Document details</h3>
        <dl class="address-block">${detailsHtml}</dl>
      </div>
    </div>
  `;
}

export function renderTotalsBox(
  rows: Array<{ label: string; value: string; emphasis?: boolean }>
): string {
  if (rows.length === 0) return "";

  const lines = rows
    .map(
      (row) => `
        <div class="totals-line${row.emphasis ? " totals-line--grand" : ""}">
          <span>${escapeHtml(row.label)}</span>
          <span>${escapeHtml(row.value)}</span>
        </div>
      `
    )
    .join("");

  return `<div class="totals-box">${lines}</div>`;
}

export function customerMetaGrid(
  customer: { name: string; email: string; phone?: string | null },
  extra?: string
): string {
  const phone = customer.phone?.trim()
    ? `<div><dt>Phone</dt><dd>${escapeHtml(customer.phone.trim())}</dd></div>`
    : "";

  return `
    <dl class="meta-grid">
      <div><dt>Bill to</dt><dd>${escapeHtml(customer.name)}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(customer.email)}</dd></div>
      ${phone}
      ${extra ?? ""}
    </dl>
  `;
}

export function detailTable(rows: Array<[string, string | null | undefined]>): string {
  const filtered = rows.filter(([, value]) => value != null && String(value).trim() !== "");
  if (filtered.length === 0) return "";

  const body = filtered
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`
    )
    .join("");

  return `<table class="detail-table"><tbody>${body}</tbody></table>`;
}

export function sectionBlock(title: string, content: string): string {
  if (!content.trim()) return "";
  return `
    <section class="section">
      <h3 class="section-title">${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

export function documentFooter(thankYou = "Thank you for choosing"): string {
  return `
    <footer class="footer">
      <p class="footer-thanks"><strong>${escapeHtml(thankYou)} ${escapeHtml(COMPANY_NAME)}.</strong></p>
      <p class="footer-terms">
        All prices are quoted in Ghana Cedis (GHS). Payment terms as agreed with our sales team.
        For questions about this document, contact us with your reference number.
      </p>
    </footer>
  `;
}

function splitDocumentFooter(body: string): { main: string; footer: string } {
  const footerMatch = body.match(/(<footer class="footer">[\s\S]*?<\/footer>)\s*$/);
  if (!footerMatch) {
    return { main: body, footer: "" };
  }
  const footer = footerMatch[1];
  const main = body.slice(0, body.length - footerMatch[0].length);
  return { main, footer };
}

export function wrapDocument(title: string, body: string, autoPrint = false): string {
  const printScript = autoPrint
    ? "<script>window.onload=function(){window.print();};</script>"
    : "";
  const { main, footer } = splitDocumentFooter(body);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ${escapeHtml(SITE_NAME)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body class="document">
  ${printLetterheadMarkup()}
  <div class="document-main">${main}</div>
  ${footer}
  ${printScript}
</body>
</html>`;
}

export type PrintableDocumentResult =
  | { ok: true; method: "popup" | "iframe" | "pdf" }
  | { ok: false; error: string };

const MIN_HTML_LENGTH = 80;

const PRINT_IMAGE_MAX_WAIT_MS = 1500;

const FAST_PRINT_SCRIPT = `<script>(function(){var done=false;var MAX_WAIT=${PRINT_DIALOG_MAX_WAIT_MS};var IMG_WAIT=${PRINT_IMAGE_MAX_WAIT_MS};function setTitle(){try{var t=document.querySelector('title');var raw=t&&t.textContent?t.textContent.trim():'';if(raw&&!/^about:blank$/i.test(document.title)&&!/^about:blank$/i.test(raw)){document.title=raw;}else{document.title='True Goshen Invoice';}}catch(e){document.title='True Goshen Invoice';}}function go(){if(done)return;done=true;setTitle();try{window.focus();window.print();}catch(e){}}function whenImagesReady(cb){var imgs=Array.prototype.slice.call(document.images||[]);if(!imgs.length)return cb();var pending=imgs.filter(function(i){return!i.complete;});if(!pending.length)return cb();var left=pending.length,timer=setTimeout(cb,IMG_WAIT);pending.forEach(function(img){img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});});function done(){if(--left<=0){clearTimeout(timer);cb();}}}function start(){whenImagesReady(function(){setTimeout(go,50);});setTimeout(go,MAX_WAIT);}if(document.readyState==='complete'||document.readyState==='interactive')start();else document.addEventListener('DOMContentLoaded',start,{once:true});})();</script>`;

function withAutoPrintScript(html: string): string {
  if (html.includes("window.print()")) return html;
  return html.replace("</body>", `${FAST_PRINT_SCRIPT}</body>`);
}

function validatePrintableHtml(html: string): PrintableDocumentResult | null {
  const trimmed = html.trim();
  if (!trimmed || trimmed.length < MIN_HTML_LENGTH) {
    return { ok: false, error: "Document is empty. Refresh the page and try again." };
  }
  if (!/<body[\s>]/i.test(trimmed)) {
    return { ok: false, error: "Invalid document. Refresh the page and try again." };
  }
  return null;
}

function extractDocumentTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const raw = match?.[1]?.trim() ?? "";
  if (!raw || /^about:blank$/i.test(raw)) return "True Goshen Invoice";
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function createHiddenPrintIframe(): {
  iframe: HTMLIFrameElement;
  win: Window;
  doc: Document;
} | null {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print document");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    return null;
  }

  return { iframe, win, doc };
}

function scheduleIframeCleanup(iframe: HTMLIFrameElement, win: Window): void {
  const cleanup = () => {
    setTimeout(() => iframe.remove(), 300);
  };

  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 60_000);
}

function writeHtmlToPrintTarget(
  doc: Document,
  html: string,
  method: "iframe" | "popup"
): PrintableDocumentResult {
  const invalid = validatePrintableHtml(html);
  if (invalid) return invalid;

  const printHtml = withAutoPrintScript(html);
  doc.open();
  doc.write(printHtml);
  doc.close();
  doc.title = extractDocumentTitle(html);

  return { ok: true, method };
}

function printViaHiddenIframe(html: string): boolean {
  const target = createHiddenPrintIframe();
  if (!target) return false;

  scheduleIframeCleanup(target.iframe, target.win);
  const result = writeHtmlToPrintTarget(target.doc, html, "iframe");
  return result.ok;
}

function printViaBlobPopup(html: string): boolean {
  const printHtml = withAutoPrintScript(html);
  const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }

  const revoke = () => URL.revokeObjectURL(url);
  win.addEventListener("load", revoke, { once: true });
  setTimeout(revoke, 60_000);

  try {
    win.opener = null;
  } catch {
    /* ignore */
  }

  return true;
}

export type PrintSession =
  | {
      ok: true;
      method: "iframe" | "popup";
      complete: (html: string) => PrintableDocumentResult;
      cancel: () => void;
    }
  | { ok: false; error: string };

/**
 * Reserve a print target synchronously on user click (before any await).
 * Call complete() after async data loads, or cancel() on failure.
 */
export function beginPrintSession(): PrintSession {
  const iframeTarget = createHiddenPrintIframe();
  if (iframeTarget) {
    scheduleIframeCleanup(iframeTarget.iframe, iframeTarget.win);
    return {
      ok: true,
      method: "iframe",
      complete: (html) => writeHtmlToPrintTarget(iframeTarget.doc, html, "iframe"),
      cancel: () => iframeTarget.iframe.remove(),
    };
  }

  const win = window.open("about:blank", "_blank");
  if (!win) {
    return { ok: false, error: "Allow popups or try Download." };
  }

  try {
    win.opener = null;
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    method: "popup",
    complete: (html) => {
      const doc = win.document;
      if (!doc) {
        win.close();
        return { ok: false, error: "Print window unavailable." };
      }
      return writeHtmlToPrintTarget(doc, html, "popup");
    },
    cancel: () => {
      try {
        win.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Open the browser print dialog immediately — never waits for PDF generation. */
export function printPrintableDocument(html: string): PrintableDocumentResult {
  return openPrintableDocument(html);
}

export function openPrintableDocument(html: string): PrintableDocumentResult {
  const invalid = validatePrintableHtml(html);
  if (invalid) return invalid;

  const printHtml = withAutoPrintScript(html);

  // Hidden iframe avoids about:blank in browser print headers/footers.
  if (printViaHiddenIframe(printHtml)) {
    return { ok: true, method: "iframe" };
  }

  if (printViaBlobPopup(html)) {
    return { ok: true, method: "popup" };
  }

  return { ok: false, error: "Allow popups or try Download." };
}

function stripPrintScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function normalizePdfFilename(filename: string): string {
  const base = filename.replace(/\.(html|pdf)$/i, "");
  return `${base}.pdf`;
}

function isInlineImage(img: HTMLImageElement): boolean {
  const src = img.currentSrc || img.src;
  return src.startsWith("data:") || src.startsWith("blob:");
}

/** Wait for document images (logo, thumbnails) before PDF capture. */
function waitForDocumentImages(doc: Document, maxWaitMs = PRINT_IMAGE_MAX_WAIT_MS): Promise<void> {
  return new Promise((resolve) => {
    const imgs = Array.from(doc.images);
    if (imgs.length === 0) {
      resolve();
      return;
    }

    const pending = imgs.filter((img) => !img.complete);
    if (pending.length === 0) {
      resolve();
      return;
    }

    let left = pending.length;
    const timer = window.setTimeout(resolve, maxWaitMs);

    const done = () => {
      if (--left <= 0) {
        window.clearTimeout(timer);
        resolve();
      }
    };

    for (const img of pending) {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

/** Replace slow external thumbnails with placeholders so html2canvas never blocks. */
function replaceExternalImagesForPdf(doc: Document): void {
  for (const img of Array.from(doc.images)) {
    if (isInlineImage(img)) continue;
    const placeholder = doc.createElement("div");
    placeholder.className = img.className.includes("item-thumb")
      ? "item-thumb-placeholder"
      : "letterhead-bg-fallback";
    placeholder.setAttribute("aria-hidden", "true");
    if (img.className.includes("letterhead-bg")) {
      placeholder.style.cssText = "width:210mm;height:297mm;background:#fff;";
    }
    img.replaceWith(placeholder);
  }
}

let html2pdfModule: Promise<typeof import("html2pdf.js").default> | null = null;

function loadHtml2Pdf() {
  html2pdfModule ??= import("html2pdf.js").then((mod) => mod.default);
  return html2pdfModule;
}

/** Prefetch html2pdf.js so the first PDF click pays less import latency. */
export function preloadPdfEngine(): void {
  void loadHtml2Pdf();
}

function measureDocumentHeight(doc: Document): number {
  const body = doc.body;
  const root = doc.documentElement;
  return Math.max(
    body.scrollHeight,
    body.offsetHeight,
    root.scrollHeight,
    root.offsetHeight,
    1
  );
}

async function htmlToPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "PDF render");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PRINT_PAGE_WIDTH_PX}px;border:0;visibility:hidden;overflow:visible;`;
  document.body.appendChild(iframe);

  try {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) throw new Error("Render frame unavailable");

    const cleanHtml = stripPrintScripts(html);

    await new Promise<void>((resolve) => {
      const onLoad = () => resolve();
      win.addEventListener("load", onLoad, { once: true });
      doc.open();
      doc.write(cleanHtml);
      doc.close();
      if (doc.readyState === "complete") {
        win.removeEventListener("load", onLoad);
        resolve();
      }
    });

    replaceExternalImagesForPdf(doc);
    await waitForDocumentImages(doc);

    const bodyHeight = measureDocumentHeight(doc);
    iframe.style.height = `${bodyHeight}px`;

    const html2pdf = await loadHtml2Pdf();
    const pdfOptions = {
      margin: [0, 0, 0, 0],
      filename: "document.pdf",
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: PDF_CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: PRINT_PAGE_WIDTH_PX,
        windowWidth: PRINT_PAGE_WIDTH_PX,
        height: bodyHeight,
        windowHeight: bodyHeight,
        scrollX: 0,
        scrollY: 0,
      },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".doc-meta", ".totals-box", ".payment-note"],
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    return html2pdf()
      .set(pdfOptions as never)
      .from(doc.body)
      .outputPdf("blob");
  } finally {
    iframe.remove();
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = normalizePdfFilename(filename);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function getCachedPrintablePdf(html: string): Blob | null {
  return getCachedPdfBlob(html);
}

export function isPrintablePdfGenerating(html: string): boolean {
  return isPdfGenerationInFlight(html);
}

export function prewarmPrintablePdf(html: string): Promise<void> {
  const invalid = validatePrintableHtml(html);
  if (invalid) return Promise.resolve();
  return getOrGeneratePdfBlob(html, () => htmlToPdfBlob(html)).then(() => undefined);
}

export async function downloadPrintableDocument(
  html: string,
  filename: string
): Promise<PrintableDocumentResult> {
  const invalid = validatePrintableHtml(html);
  if (invalid) return invalid;

  try {
    const blob = await getOrGeneratePdfBlob(html, () => htmlToPdfBlob(html));
    triggerBlobDownload(blob, filename);
    return { ok: true, method: "pdf" };
  } catch {
    return { ok: false, error: "Download failed. Please try again." };
  }
}
