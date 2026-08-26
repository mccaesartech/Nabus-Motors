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
  LETTERHEAD_CONTINUATION_DATA_URL,
  LETTERHEAD_DATA_URL,
  LETTERHEAD_SAFE_ZONE,
} from "@/lib/print/letterhead-data";
import { getAutoSiteUrl } from "@/lib/site-url";

export { LETTERHEAD_SAFE_ZONE };

export const PRINT_PAGE_WIDTH_PX = 794;
/**
 * A4 height at {@link PRINT_PAGE_WIDTH_PX}, floored to match the slice height
 * html2pdf uses (`floor(canvasWidth * 297 / 210)`). Rounding up instead makes every
 * document overshoot its last page by ~1px, which html2pdf turns into a blank page.
 */
export const PRINT_PAGE_HEIGHT_PX = Math.floor(
  PRINT_PAGE_WIDTH_PX * (297 / 210)
);

/** Absorbs sub-pixel layout rounding so a document never spills onto a blank page. */
const PAGE_HEIGHT_TOLERANCE_PX = 4;

/** Root class the document stylesheet is scoped to. */
const DOCUMENT_SCOPE_CLASS = "tga-doc";
const DOC = `.${DOCUMENT_SCOPE_CLASS}`;

/**
 * In-flow height of the document. The letterhead layers are absolutely positioned so
 * they are excluded, which is what makes the page count reflect real content.
 */
function measureContentHeight(root: HTMLElement): number {
  return root.getBoundingClientRect().height;
}

function pageCountForHeight(height: number): number {
  return Math.max(
    1,
    Math.ceil((height - PAGE_HEIGHT_TOLERANCE_PX) / PRINT_PAGE_HEIGHT_PX)
  );
}

/**
 * Stack A4 letterhead layers inside `root` — page 1 full letterhead, page 2+ footer only.
 * Uses real `<img>` elements (not CSS background-image) so browser Print includes the
 * chrome without requiring "Background graphics". Download/html2canvas paints the same imgs.
 */
function appendPageBackgrounds(root: HTMLElement, pageCount: number): void {
  root.querySelector(".page-backgrounds")?.remove();

  const doc = root.ownerDocument;
  const container = doc.createElement("div");
  container.className = "page-backgrounds";
  container.setAttribute("aria-hidden", "true");

  for (let i = 0; i < pageCount; i++) {
    const page = doc.createElement("div");
    page.className =
      i === 0 ? "page-bg page-bg--first" : "page-bg page-bg--continuation";
    page.style.top = `${i * PRINT_PAGE_HEIGHT_PX}px`;

    const img = doc.createElement("img");
    img.className = "page-bg__img";
    img.alt = "";
    img.decoding = "sync";
    img.draggable = false;
    img.src =
      i === 0 ? LETTERHEAD_DATA_URL : LETTERHEAD_CONTINUATION_DATA_URL;
    page.appendChild(img);

    container.appendChild(page);
  }

  root.insertBefore(container, root.firstChild);
}

/** Layout pages and inject letterhead backgrounds (Print path; mirrors Download). */
export function injectPageBackgrounds(doc: Document): void {
  const body = doc.body;
  if (!body) return;
  prepareDocumentForOutput(body);
}

/**
 * html2canvas scale — 1.0 prioritizes speed and text stays readable on A4. Keep it at 1
 * so {@link PRINT_PAGE_HEIGHT_PX} equals html2pdf's canvas page slice exactly.
 */
const PDF_CANVAS_SCALE = 1.0;
/** Max wait before opening print dialog even if images are still loading. */
const PRINT_DIALOG_MAX_WAIT_MS = 2000;

const LETTERHEAD_TOP_MM = LETTERHEAD_SAFE_ZONE.topMm;
const LETTERHEAD_BOTTOM_MM = LETTERHEAD_SAFE_ZONE.bottomMm;
const LETTERHEAD_LEFT_MM = LETTERHEAD_SAFE_ZONE.leftMm;
const LETTERHEAD_RIGHT_MM = LETTERHEAD_SAFE_ZONE.rightMm;
const PRINT_BODY_PADDING = `${LETTERHEAD_TOP_MM}mm ${LETTERHEAD_RIGHT_MM}mm ${LETTERHEAD_BOTTOM_MM}mm ${LETTERHEAD_LEFT_MM}mm`;

/** Continuation pages carry footer branding only, so they need far less headroom. */
const LETTERHEAD_CONTINUATION_TOP_MM = 20;
const MM_TO_PX = 96 / 25.4;
const PAGE_BOTTOM_SAFE_PX = Math.round(LETTERHEAD_BOTTOM_MM * MM_TO_PX);
const PAGE_CONTINUATION_TOP_SAFE_PX = Math.round(
  LETTERHEAD_CONTINUATION_TOP_MM * MM_TO_PX
);
/** Height available for content on a continuation page. */
const PAGE_USABLE_HEIGHT_PX =
  PRINT_PAGE_HEIGHT_PX - PAGE_CONTINUATION_TOP_SAFE_PX - PAGE_BOTTOM_SAFE_PX;
/** Blocks taller than this are split into their children instead of moved whole. */
const PAGE_UNIT_MAX_HEIGHT_PX = Math.round(PAGE_USABLE_HEIGHT_PX / 2);

/**
 * Document rules, scoped to {@link DOCUMENT_SCOPE_CLASS}. PDF capture renders the
 * document inside the app page, so this sheet must not match app markup, and the
 * explicit resets keep the output identical with or without the app's own CSS.
 */
export const DOCUMENT_STYLES = `
  ${DOC}, ${DOC} *, ${DOC} *::before, ${DOC} *::after { box-sizing: border-box; }
  ${DOC} h1, ${DOC} h2, ${DOC} h3, ${DOC} p,
  ${DOC} dl, ${DOC} dt, ${DOC} dd,
  ${DOC} table, ${DOC} th, ${DOC} td,
  ${DOC} div, ${DOC} section, ${DOC} header, ${DOC} footer {
    margin: 0;
    padding: 0;
  }
  ${DOC} {
    position: relative;
    display: flex;
    flex-direction: column;
    width: ${PRINT_PAGE_WIDTH_PX}px;
    max-width: ${PRINT_PAGE_WIDTH_PX}px;
    height: auto;
    min-height: auto;
    overflow: visible;
    margin: 0 auto;
    padding: ${PRINT_BODY_PADDING};
    background: #fff;
    color: #111;
    text-align: left;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 10pt;
    line-height: 1.35;
  }
  ${DOC} h1, ${DOC} h2, ${DOC} h3 { font-family: inherit; letter-spacing: normal; }
  ${DOC} p { margin: 0 0 6px; }
  ${DOC} strong { font-weight: 700; }
  ${DOC} .page-backgrounds {
    position: absolute;
    top: 0;
    left: 0;
    width: ${PRINT_PAGE_WIDTH_PX}px;
    z-index: 0;
    pointer-events: none;
  }
  ${DOC} .page-bg {
    position: absolute;
    left: 0;
    width: ${PRINT_PAGE_WIDTH_PX}px;
    height: ${PRINT_PAGE_HEIGHT_PX}px;
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  ${DOC} .page-bg__img {
    display: block;
    width: ${PRINT_PAGE_WIDTH_PX}px;
    height: ${PRINT_PAGE_HEIGHT_PX}px;
    max-width: none;
    object-fit: fill;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  ${DOC} .document-main {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
  }
  ${DOC} .no-break { page-break-inside: avoid; break-inside: avoid; }
  ${DOC} .doc-meta {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    margin-bottom: 6px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ${DOC} .doc-meta-spacer { flex: 1 1 auto; }
  ${DOC} .doc-meta-block { flex: 0 0 auto; text-align: right; }
  ${DOC} .doc-meta-type {
    margin: 0 0 2px;
    font-size: 13pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #1e3a8a;
    line-height: 1.1;
  }
  ${DOC} .doc-meta-ref {
    margin: 0;
    font-size: 9pt;
    color: #374151;
    line-height: 1.3;
  }
  ${DOC} .doc-meta-ref strong {
    font-family: ui-monospace, monospace;
    color: #111;
    font-weight: 600;
  }
  ${DOC} .doc-title { font-size: 14px; font-weight: 600; margin: 0 0 2px; color: #111; line-height: 1.2; }
  ${DOC} .doc-subtitle { font-size: 9pt; color: #555; margin: 0 0 10px; line-height: 1.3; }
  ${DOC} .section { margin-bottom: 12px; page-break-inside: auto; break-inside: auto; }
  ${DOC} .section-title {
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
  ${DOC} .address-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ${DOC} .address-col {
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }
  ${DOC} .address-label {
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
    margin: 0 0 5px;
  }
  ${DOC} .address-block { margin: 0; }
  ${DOC} .address-block dt { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; margin: 5px 0 0; }
  ${DOC} .address-block dt:first-child { margin-top: 0; }
  ${DOC} .address-block dd { margin: 1px 0 0; font-weight: 500; color: #111; font-size: 9pt; }
  ${DOC} .address-name { font-size: 10pt; font-weight: 600; }
  ${DOC} .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 14px;
    margin-bottom: 0;
    padding: 8px 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ${DOC} .meta-grid dt { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; margin: 0; }
  ${DOC} .meta-grid dd { margin: 1px 0 0; font-weight: 500; color: #111; font-size: 9pt; }
  ${DOC} .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  ${DOC} .detail-table th,
  ${DOC} .detail-table td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  ${DOC} .detail-table th {
    width: 34%;
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #6b7280;
    background: #f9fafb;
    border-right: 1px solid #f3f4f6;
  }
  ${DOC} .detail-table td { color: #111; }
  ${DOC} .detail-table tr { page-break-inside: auto; break-inside: auto; }
  ${DOC} .message-block {
    margin-top: 0;
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    white-space: pre-wrap;
    font-size: 9pt;
    line-height: 1.4;
  }
  ${DOC} table.items {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-bottom: 0;
    font-size: 9pt;
  }
  ${DOC} table.items td:nth-child(2),
  ${DOC} table.items th:nth-child(2) {
    word-break: break-word;
  }
  ${DOC} table.items thead { display: table-header-group; }
  ${DOC} table.items th {
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
  ${DOC} table.items td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  ${DOC} table.items tbody tr { page-break-inside: auto; break-inside: auto; }
  ${DOC} table.items .num { text-align: right; white-space: nowrap; }
  ${DOC} .item-name { font-weight: 500; line-height: 1.25; }
  ${DOC} .item-detail { font-size: 8pt; color: #6b7280; margin-top: 1px; line-height: 1.2; }
  ${DOC} .item-thumb,
  ${DOC} .item-thumb-placeholder {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    background: #f3f4f6;
    display: block;
  }
  ${DOC} .item-thumb-placeholder { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); }
  ${DOC} .totals-box {
    margin: 8px 0 0 auto;
    width: min(100%, 280px);
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ${DOC} .totals-line {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 10px;
    font-size: 9pt;
    border-bottom: 1px solid #f3f4f6;
  }
  ${DOC} .totals-line:last-child { border-bottom: none; }
  ${DOC} .totals-line--grand {
    background: #eff6ff;
    border-top: 1.5px solid #1e3a8a;
    font-size: 10pt;
    font-weight: 700;
    color: #1e3a8a;
  }
  ${DOC} .payment-note {
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
  ${DOC} .empty-note {
    margin: 0;
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    font-size: 9pt;
    color: #6b7280;
  }
  ${DOC} .total-row {
    text-align: right;
    font-size: 10pt;
    font-weight: 600;
    padding: 8px 6px;
    border-top: 1.5px solid #1e3a8a;
    margin-top: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ${DOC} .footer {
    position: relative;
    z-index: 1;
    margin-top: auto;
    padding-top: 6px;
    font-size: 8.5pt;
    color: #4b5563;
    text-align: center;
    line-height: 1.35;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ${DOC} .footer p { margin: 0 0 3px; }
  ${DOC} .footer-thanks { color: #111; }
  ${DOC} .footer-terms {
    margin: 0;
    font-size: 7.5pt;
    color: #6b7280;
    line-height: 1.35;
  }
  ${DOC} .no-print { display: none !important; }
`;

/** Page-box rules — only ever loaded into a standalone print document, never the app page. */
const PRINT_ONLY_STYLES = `
  @page {
    margin: 0;
    size: A4;
  }
  @media print {
    ${DOC},
    ${DOC} * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    ${DOC} { width: auto; max-width: none; font-size: 9.5pt; }
    ${DOC} .page-backgrounds,
    ${DOC} .page-bg,
    ${DOC} .page-bg__img {
      display: block !important;
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

export const PRINT_STYLES = `${DOCUMENT_STYLES}${PRINT_ONLY_STYLES}`;

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
  // autoPrint scripts are a fallback only — openPrintableDocument drives print from the
  // parent page (CSP nonce / about:blank inheritance blocks unnonced inline scripts).
  const printScript = autoPrint
    ? "<script>window.onload=function(){if(window.__tgaPrintStarted)return;window.__tgaPrintStarted=true;try{window.focus();window.print();}catch(e){}};</script>"
    : "";
  const { main, footer } = splitDocumentFooter(body);

  // Letterhead backgrounds + pagination are applied by the parent (Print) or PDF stage
  // (Download) via prepareDocumentForOutput — keep the HTML shell identical for both.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ${escapeHtml(SITE_NAME)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body class="document ${DOCUMENT_SCOPE_CLASS}">
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

type PrintableWindow = Window & { __tgaPrintStarted?: boolean };

/**
 * Read the active page CSP nonce (Next.js stamps it on framework scripts).
 * about:blank print frames inherit the parent CSP, so inline print scripts need this.
 */
function getActiveCspNonce(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const scripts = document.querySelectorAll("script[nonce]");
    for (const node of scripts) {
      const el = node as HTMLScriptElement;
      const nonce = el.nonce || el.getAttribute("nonce");
      if (nonce) return nonce;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Stamp the page CSP nonce onto inline <script> tags so print shells run under enforce CSP. */
function stampCspNonceOnScripts(html: string): string {
  const nonce = getActiveCspNonce();
  if (!nonce) return html;
  const safe = nonce.replace(/"/g, "");
  return html.replace(/<script(?![^>]*\bnonce\s*=)/gi, `<script nonce="${safe}"`);
}

/**
 * Fallback print script for popup/iframe documents.
 * Honors __tgaPrintStarted so parent-driven print does not double-open the dialog.
 * Must be nonce-stamped before document.write under production CSP.
 */
const DEFERRED_PRINT_SCRIPT = `<script>(function(){var done=false;var MAX_WAIT=${PRINT_DIALOG_MAX_WAIT_MS};var IMG_WAIT=${PRINT_IMAGE_MAX_WAIT_MS};function setTitle(){try{var t=document.querySelector('title');var raw=t&&t.textContent?t.textContent.trim():'';if(raw&&!/^about:blank$/i.test(document.title)&&!/^about:blank$/i.test(raw)){document.title=raw;}else{document.title='True Goshen Invoice';}}catch(e){document.title='True Goshen Invoice';}}function go(){if(done||window.__tgaPrintStarted)return;done=true;window.__tgaPrintStarted=true;setTitle();try{window.focus();window.print();}catch(e){window.__tgaPrintStarted=false;}}function whenImagesReady(cb){var imgs=Array.prototype.slice.call(document.images||[]);if(!imgs.length)return cb();var pending=imgs.filter(function(i){return!i.complete;});if(!pending.length)return cb();var left=pending.length,timer=setTimeout(cb,IMG_WAIT);pending.forEach(function(img){img.addEventListener('load',tick,{once:true});img.addEventListener('error',tick,{once:true});});function tick(){if(--left<=0){clearTimeout(timer);cb();}}}function start(){whenImagesReady(go);setTimeout(go,MAX_WAIT);}if(document.readyState==='complete'||document.readyState==='interactive')start();else document.addEventListener('DOMContentLoaded',start,{once:true});})();</script>`;

function withDeferredPrintScript(html: string): string {
  if (html.includes("window.print()")) return html;
  if (!html.includes("</body>")) return `${html}${DEFERRED_PRINT_SCRIPT}`;
  return html.replace("</body>", `${DEFERRED_PRINT_SCRIPT}</body>`);
}

function preparePrintableHtml(html: string): string {
  return stampCspNonceOnScripts(withDeferredPrintScript(html));
}

function triggerPrintOnce(win: Window): void {
  const target = win as PrintableWindow;
  if (target.__tgaPrintStarted) return;
  target.__tgaPrintStarted = true;
  try {
    win.focus();
    win.print();
  } catch {
    target.__tgaPrintStarted = false;
  }
}

/** Parent-driven print after async loads — does not rely on CSP-blocked inline scripts. */
function scheduleParentPrint(win: Window, sync: boolean): void {
  const doc = win.document;
  const imagesReady =
    Array.from(doc.images ?? []).every((img) => img.complete);

  // Prefer same-turn print when letterhead imgs are already decoded so the
  // user-gesture chain stays intact (required for some Chromium iframe prints).
  if (sync && imagesReady) {
    triggerPrintOnce(win);
    return;
  }

  let finished = false;
  const run = () => {
    if (finished) return;
    finished = true;
    triggerPrintOnce(win);
  };

  void waitForDocumentImages(doc, PRINT_IMAGE_MAX_WAIT_MS).then(run);
  setTimeout(run, PRINT_DIALOG_MAX_WAIT_MS);
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
  // Full-width off-screen frame (same layout as PDF render) — 0×0 / visibility:hidden
  // frames fail to open the print dialog in Chromium under some CSP layouts.
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PRINT_PAGE_WIDTH_PX}px;height:${PRINT_PAGE_HEIGHT_PX}px;border:0;opacity:0;pointer-events:none;overflow:hidden;`;
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    return null;
  }

  return { iframe, win, doc };
}

function sizePrintIframe(iframe: HTMLIFrameElement, doc: Document): void {
  const height = Math.max(measureDocumentHeight(doc), PRINT_PAGE_HEIGHT_PX);
  iframe.style.height = `${height}px`;
}

function scheduleIframeCleanup(iframe: HTMLIFrameElement, win: Window): void {
  const cleanup = () => {
    setTimeout(() => iframe.remove(), 300);
  };

  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 60_000);
}

type WritePrintTargetOptions = {
  /** Print synchronously from the click handler (iframe / cached data). */
  syncPrint?: boolean;
  win?: Window | null;
  iframe?: HTMLIFrameElement | null;
};

function writeHtmlToPrintTarget(
  doc: Document,
  html: string,
  method: "iframe" | "popup",
  options: WritePrintTargetOptions = {}
): PrintableDocumentResult {
  const invalid = validatePrintableHtml(html);
  if (invalid) return invalid;

  const { syncPrint = false, win = null, iframe = null } = options;
  // Always prepare nonce-stamped deferred print as backup; parent still drives print
  // because production CSP blocks unnonced inline scripts in inherited about:blank docs.
  const printHtml = preparePrintableHtml(html);
  doc.open();
  doc.write(printHtml);
  doc.close();
  doc.title = extractDocumentTitle(html);
  injectPageBackgrounds(doc);

  if (iframe) {
    sizePrintIframe(iframe, doc);
  }

  if (win) {
    scheduleParentPrint(win, syncPrint);
  }

  return { ok: true, method };
}

function printViaHiddenIframe(html: string): boolean {
  const target = createHiddenPrintIframe();
  if (!target) return false;

  scheduleIframeCleanup(target.iframe, target.win);
  const result = writeHtmlToPrintTarget(target.doc, html, "iframe", {
    syncPrint: true,
    win: target.win,
    iframe: target.iframe,
  });
  return result.ok;
}

function printViaBlobPopup(html: string): boolean {
  const printHtml = preparePrintableHtml(html);
  const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }

  const revoke = () => URL.revokeObjectURL(url);
  let armed = false;
  const armPrint = () => {
    if (armed) return;
    armed = true;
    try {
      const doc = win.document;
      if (doc?.body) injectPageBackgrounds(doc);
    } catch {
      /* blob edge cases */
    }
    scheduleParentPrint(win, false);
  };

  win.addEventListener(
    "load",
    () => {
      armPrint();
      revoke();
    },
    { once: true }
  );
  // If load already fired (cached blob), print immediately.
  if (win.document?.readyState === "complete") {
    armPrint();
  }
  setTimeout(() => {
    armPrint();
    revoke();
  }, PRINT_DIALOG_MAX_WAIT_MS + 50);
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

const PRINT_LOADING_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Loading…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#374151;}</style>
</head><body><p>Loading document…</p></body></html>`;

/**
 * Reserve a print target synchronously on user click (before any await).
 * Prefers a popup window so print still works after async fetches.
 * Call complete() after async data loads, or cancel() on failure.
 */
export function beginPrintSession(): PrintSession {
  const win = window.open("about:blank", "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }

    const loadingDoc = win.document;
    if (loadingDoc) {
      loadingDoc.open();
      loadingDoc.write(PRINT_LOADING_HTML);
      loadingDoc.close();
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
        return writeHtmlToPrintTarget(doc, html, "popup", {
          syncPrint: false,
          win,
        });
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

  const iframeTarget = createHiddenPrintIframe();
  if (iframeTarget) {
    scheduleIframeCleanup(iframeTarget.iframe, iframeTarget.win);
    return {
      ok: true,
      method: "iframe",
      complete: (html) =>
        writeHtmlToPrintTarget(iframeTarget.doc, html, "iframe", {
          syncPrint: false,
          win: iframeTarget.win,
          iframe: iframeTarget.iframe,
        }),
      cancel: () => iframeTarget.iframe.remove(),
    };
  }

  return { ok: false, error: "Allow popups or try Download." };
}

/** Open the browser print dialog immediately — never waits for PDF generation. */
export function printPrintableDocument(html: string): PrintableDocumentResult {
  return openPrintableDocument(html);
}

export function openPrintableDocument(html: string): PrintableDocumentResult {
  const invalid = validatePrintableHtml(html);
  if (invalid) return invalid;

  // Hidden iframe + synchronous print keeps the user-gesture chain intact.
  if (printViaHiddenIframe(html)) {
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
function waitForDocumentImages(
  root: ParentNode,
  maxWaitMs = PRINT_IMAGE_MAX_WAIT_MS
): Promise<void> {
  return new Promise((resolve) => {
    const imgs = Array.from(root.querySelectorAll("img"));
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
function replaceExternalImagesForPdf(root: HTMLElement): void {
  for (const img of Array.from(root.querySelectorAll("img"))) {
    if (isInlineImage(img)) continue;
    const placeholder = root.ownerDocument.createElement("div");
    placeholder.className = "item-thumb-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
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

/** A block that must not be split across a page boundary. */
type PageUnit = {
  el: HTMLElement;
  /** Height that has to stay on one page (whole block, or head + first row for long tables). */
  keepHeight: number;
  /** Insert filler above the block so it starts `offsetPx` lower. */
  push: (offsetPx: number) => void;
};

function pushWithSpacer(el: HTMLElement): (offsetPx: number) => void {
  return (offsetPx) => {
    const doc = el.ownerDocument;

    // A <div> is not renderable inside <tbody>, so rows need a filler row instead.
    if (el instanceof HTMLTableRowElement) {
      const spacerRow = doc.createElement("tr");
      spacerRow.setAttribute("aria-hidden", "true");
      const cell = doc.createElement("td");
      cell.colSpan = Math.max(1, el.cells.length);
      cell.style.cssText = `height:${offsetPx}px;padding:0;border:0;background:transparent;`;
      spacerRow.appendChild(cell);
      el.parentNode?.insertBefore(spacerRow, el);
      return;
    }

    const spacer = doc.createElement("div");
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = `display:block;width:100%;height:${offsetPx}px;`;
    el.parentNode?.insertBefore(spacer, el);
  };
}

function tablePageUnits(table: HTMLTableElement): PageUnit[] {
  const rows = Array.from(table.querySelectorAll("tbody > tr")) as HTMLTableRowElement[];
  if (rows.length === 0) {
    return [
      {
        el: table,
        keepHeight: table.getBoundingClientRect().height,
        push: pushWithSpacer(table),
      },
    ];
  }

  // Keep the column headings with at least one row, then break between rows.
  const headHeight = table.tHead?.getBoundingClientRect().height ?? 0;
  const units: PageUnit[] = [
    {
      el: table,
      keepHeight: headHeight + rows[0].getBoundingClientRect().height,
      push: pushWithSpacer(table),
    },
  ];

  for (const row of rows.slice(1)) {
    units.push({
      el: row,
      keepHeight: row.getBoundingClientRect().height,
      push: pushWithSpacer(row),
    });
  }

  return units;
}

function collectPageUnits(parent: Element, depth = 0): PageUnit[] {
  const units: PageUnit[] = [];

  for (const child of Array.from(parent.children)) {
    const el = child as HTMLElement;
    if (el.classList.contains("page-backgrounds")) continue;
    if (el.tagName === "STYLE" || el.tagName === "SCRIPT") continue;

    const keepHeight = el.getBoundingClientRect().height;
    if (keepHeight <= 0) continue;

    const splittable =
      keepHeight > PAGE_UNIT_MAX_HEIGHT_PX && el.children.length > 0 && depth < 3;
    if (!splittable) {
      units.push({ el, keepHeight, push: pushWithSpacer(el) });
      continue;
    }

    if (el instanceof HTMLTableElement) {
      units.push(...tablePageUnits(el));
      continue;
    }

    units.push(...collectPageUnits(el, depth + 1));
  }

  return units;
}

/**
 * Push `unit` down if it would land on the letterhead footer art or in a continuation
 * page's top margin. Returns true when filler was inserted (positions changed).
 */
function placePageUnit(root: HTMLElement, unit: PageUnit): boolean {
  const top = unit.el.getBoundingClientRect().top - root.getBoundingClientRect().top;
  const page = Math.max(0, Math.floor(top / PRINT_PAGE_HEIGHT_PX));
  const pageTop = page * PRINT_PAGE_HEIGHT_PX;
  const pageBottom = pageTop + PRINT_PAGE_HEIGHT_PX - PAGE_BOTTOM_SAFE_PX;

  // Page 1 gets its headroom from the document padding; later pages need it added here.
  if (page > 0) {
    const contentTop = pageTop + PAGE_CONTINUATION_TOP_SAFE_PX;
    if (top < contentTop - PAGE_HEIGHT_TOLERANCE_PX) {
      unit.push(Math.round(contentTop - top));
      return true;
    }
  }

  if (top + unit.keepHeight <= pageBottom + PAGE_HEIGHT_TOLERANCE_PX) return false;

  const nextContentTop =
    pageTop + PRINT_PAGE_HEIGHT_PX + PAGE_CONTINUATION_TOP_SAFE_PX;
  unit.push(Math.round(nextContentTop - top));
  return true;
}

/**
 * Break the staged document onto whole A4 pages and lock its height to an exact page
 * multiple, so html2pdf's `ceil(canvasHeight / pageHeight)` can never invent a page.
 */
function layoutDocumentPages(root: HTMLElement): number {
  try {
    const main = root.querySelector(".document-main") ?? root;
    for (const unit of collectPageUnits(main)) {
      // A single re-check settles the case where the first nudge lands the block
      // in the next page's top margin.
      if (placePageUnit(root, unit)) placePageUnit(root, unit);
    }
  } catch {
    // Pagination is best effort — a failure just means plain fixed-height slicing.
  }

  const pageCount = pageCountForHeight(measureContentHeight(root));
  root.style.height = `${pageCount * PRINT_PAGE_HEIGHT_PX}px`;
  root.style.overflow = "hidden";
  return pageCount;
}

/**
 * Shared Print + Download prep: paginate content onto A4 slices, then inject letterhead
 * `<img>` layers so both outputs use the same HTML layout and page art (Print does not
 * rely on CSS background-image / "Background graphics").
 */
function prepareDocumentForOutput(root: HTMLElement): number {
  root.querySelector(".page-backgrounds")?.remove();
  const pageCount = layoutDocumentPages(root);
  appendPageBackgrounds(root, pageCount);
  return pageCount;
}

/**
 * Stage the document in the app page rather than an iframe. html2pdf re-parents a clone
 * of the element it is given into this document, which leaves an iframe's `<head>`
 * stylesheet behind — the document then rasterizes with none of its own CSS.
 */
function createPdfStage(html: string): { stage: HTMLElement; root: HTMLElement } {
  const parsed = new DOMParser().parseFromString(stripPrintScripts(html), "text/html");

  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.style.cssText = `position:fixed;left:-10000px;top:0;width:${PRINT_PAGE_WIDTH_PX}px;pointer-events:none;`;

  const styles = document.createElement("style");
  styles.textContent = DOCUMENT_STYLES;
  stage.appendChild(styles);

  const root = document.createElement("div");
  root.className = parsed.body.className || `document ${DOCUMENT_SCOPE_CLASS}`;
  for (let node = parsed.body.firstChild; node; node = parsed.body.firstChild) {
    root.appendChild(document.adoptNode(node));
  }

  stage.appendChild(root);
  document.body.appendChild(stage);
  return { stage, root };
}

async function htmlToPdfBlob(html: string): Promise<Blob> {
  const { stage, root } = createPdfStage(html);

  try {
    replaceExternalImagesForPdf(root);
    await waitForDocumentImages(root);

    const pageCount = prepareDocumentForOutput(root);
    const totalHeight = pageCount * PRINT_PAGE_HEIGHT_PX;

    const html2pdf = await loadHtml2Pdf();
    const pdfOptions = {
      margin: [0, 0, 0, 0],
      filename: "document.pdf",
      image: { type: "jpeg", quality: 0.92 },
      enableLinks: false,
      html2canvas: {
        scale: PDF_CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: PRINT_PAGE_WIDTH_PX,
        windowWidth: PRINT_PAGE_WIDTH_PX,
        height: totalHeight,
        windowHeight: totalHeight,
        scrollX: 0,
        scrollY: 0,
      },
      // Page breaks are already baked into the staged DOM; the plugin would double them.
      pagebreak: { mode: [], before: [], after: [], avoid: [] },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    return await html2pdf()
      .set(pdfOptions as never)
      .from(root)
      .outputPdf("blob");
  } finally {
    stage.remove();
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
