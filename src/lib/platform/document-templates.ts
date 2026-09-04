import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";
import {
  formatPlatformPrice,
  FX_MARKET_DISCLAIMER,
  formatUsdGhsRateLine,
  getActiveRates,
  rateSourceLabel,
} from "@/lib/currency";
import {
  billToAndDetails,
  brandHeader,
  detailTable,
  documentFooter,
  downloadPrintableDocument,
  escapeHtml,
  formatPrintDate,
  openPrintableDocument,
  renderTotalsBox,
  sectionBlock,
  wrapDocument,
} from "@/lib/print/document-shell";

type DocTemplateInput = {
  docType: string;
  customerName: string;
  vehicleLabel: string;
  vehiclePrice?: number;
  company?: Record<string, string>;
  reference?: string;
};

function docTitle(docType: string) {
  if (docType === "sales_agreement") return "Sales Agreement";
  if (docType === "preorder_agreement") return "Pre-Order Agreement";
  if (docType === "invoice") return "Invoice";
  return "Document";
}

function docTypeLabel(docType: string): string {
  if (docType === "sales_agreement") return "AGREEMENT";
  if (docType === "preorder_agreement") return "PRE-ORDER";
  if (docType === "invoice") return "INVOICE";
  return "DOCUMENT";
}

function documentReference(input: DocTemplateInput): string {
  if (input.reference?.trim()) return input.reference.trim().toUpperCase();
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  const prefix =
    input.docType === "sales_agreement"
      ? "SA"
      : input.docType === "preorder_agreement"
        ? "PO"
        : "INV";
  return `${prefix}-${stamp}`;
}

function fxNote(): string {
  const rates = getActiveRates();
  const ghsPerUsd = rates.GHS ?? 0;
  return `Exchange rate used: ${formatUsdGhsRateLine(ghsPerUsd)} · ${rateSourceLabel({ source: "exchangerate-api" })}. ${FX_MARKET_DISCLAIMER}`;
}

function signatureBlock(
  leftLabel: string,
  rightLabel: string
): string {
  return `
    <section class="section no-break">
      <h3 class="section-title">Signatures</h3>
      <div class="address-row">
        <div class="address-col">
          <p class="address-label">${escapeHtml(leftLabel)}</p>
          <p style="margin:28px 0 6px;border-bottom:1px solid #9ca3af;">&nbsp;</p>
          <p style="font-size:8pt;color:#6b7280;margin:0;">Signature &nbsp;&nbsp;&nbsp; Date: __________</p>
        </div>
        <div class="address-col">
          <p class="address-label">${escapeHtml(rightLabel)}</p>
          <p style="margin:28px 0 6px;border-bottom:1px solid #9ca3af;">&nbsp;</p>
          <p style="font-size:8pt;color:#6b7280;margin:0;">Signature &nbsp;&nbsp;&nbsp; Date: __________</p>
        </div>
      </div>
    </section>
  `;
}

function vehicleLineItemTable(vehicleLabel: string, vehiclePrice?: number): string {
  const rates = getActiveRates();
  const priceLabel =
    vehiclePrice != null ? formatPlatformPrice(vehiclePrice, rates) : "As quoted";

  return `
    <table class="items">
      <colgroup>
        <col />
        <col style="width:120px" />
      </colgroup>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Amount (GHS)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="item-name">${escapeHtml(vehicleLabel)}</div>
            <div class="item-detail">Vehicle</div>
          </td>
          <td class="num">${escapeHtml(priceLabel)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function preorderTotalsRows(vehiclePrice?: number) {
  if (vehiclePrice == null) return [];
  const rates = getActiveRates();
  const deposit = vehiclePrice * 0.25;
  const balance = Math.max(vehiclePrice - deposit, 0);
  return [
    { label: "Vehicle price", value: formatPlatformPrice(vehiclePrice, rates) },
    { label: "25% deposit", value: formatPlatformPrice(deposit, rates) },
    { label: "Balance due", value: formatPlatformPrice(balance, rates), emphasis: true },
  ];
}

export function buildDocumentHtml(input: DocTemplateInput) {
  const {
    docType,
    customerName,
    vehicleLabel,
    vehiclePrice,
    company = DEFAULT_SITE_SETTINGS,
  } = input;

  const title = docTitle(docType);
  const ref = documentReference(input);
  const issuedAt = new Date().toISOString();
  const safeCustomer = customerName.trim() || "Customer";
  const customer = {
    name: safeCustomer,
    email: "—",
    phone: null as string | null,
  };

  const detailsHtml = `
    <dt>Date issued</dt>
    <dd>${escapeHtml(formatPrintDate(issuedAt))}</dd>
    <dt>Document type</dt>
    <dd>${escapeHtml(title)}</dd>
    <dt>Reference</dt>
    <dd style="font-family:ui-monospace,monospace;">${escapeHtml(ref)}</dd>
  `;

  const vehicleDetails = detailTable([
    ["Vehicle", vehicleLabel],
    [
      "Vehicle price",
      vehiclePrice != null ? formatPlatformPrice(vehiclePrice) : "As quoted",
    ],
    ["Seller", company.company_name ?? company.company_legal_name ?? "Nabus Motors"],
  ]);

  const fxFootnote = `<p class="payment-note">${escapeHtml(fxNote())}</p>`;

  let body: string;

  if (docType === "invoice") {
    const totalsRows =
      vehiclePrice != null
        ? [
            { label: "Subtotal", value: formatPlatformPrice(vehiclePrice) },
            {
              label: "Grand total",
              value: formatPlatformPrice(vehiclePrice),
              emphasis: true,
            },
          ]
        : [];

    body = `
      ${brandHeader(ref, docTypeLabel(docType))}
      ${billToAndDetails(customer, detailsHtml)}
      ${sectionBlock("Line items", vehicleLineItemTable(vehicleLabel, vehiclePrice))}
      ${totalsRows.length > 0 ? renderTotalsBox(totalsRows) : ""}
      ${fxFootnote}
      <p class="payment-note">Payment terms as agreed with our sales team. Contact us with reference <strong>${escapeHtml(ref)}</strong> for payment instructions.</p>
      ${documentFooter()}
    `;
  } else if (docType === "preorder_agreement") {
    const totalsRows = preorderTotalsRows(vehiclePrice);

    body = `
      ${brandHeader(ref, docTypeLabel(docType))}
      ${billToAndDetails(customer, detailsHtml)}
      ${sectionBlock("Vehicle details", vehicleDetails)}
      ${totalsRows.length > 0 ? sectionBlock("Payment schedule", renderTotalsBox(totalsRows)) : ""}
      ${sectionBlock(
        "Pre-order terms",
        `<div class="message-block">A 25% down payment secures this pre-order. The remaining balance is due before delivery. ${escapeHtml(company.preorder_terms_b ?? "Nabus Motors handles freight forwarding & clearing where agreed.")}</div>`
      )}
      ${vehiclePrice != null ? fxFootnote : ""}
      ${signatureBlock("Customer", "Authorised dealer representative")}
      ${documentFooter()}
    `;
  } else {
    body = `
      ${brandHeader(ref, docTypeLabel(docType))}
      ${billToAndDetails(customer, detailsHtml)}
      ${sectionBlock("Vehicle details", vehicleDetails)}
      ${sectionBlock(
        "Agreement",
        `<div class="message-block">The buyer agrees to purchase the vehicle described above under ${escapeHtml(company.company_legal_name ?? company.company_name ?? "Nabus Motors")} standard terms and conditions. All prices are quoted in Ghana Cedis (GHS) unless otherwise stated.</div>`
      )}
      ${vehiclePrice != null ? fxFootnote : ""}
      ${signatureBlock("Buyer", "Seller")}
      ${documentFooter()}
    `;
  }

  return wrapDocument(title, body);
}

export function documentDownloadFilename(input: DocTemplateInput): string {
  const slug = input.vehicleLabel
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  const prefix =
    input.docType === "sales_agreement"
      ? "sales-agreement"
      : input.docType === "preorder_agreement"
        ? "preorder-agreement"
        : "invoice";
  return `${prefix}-${slug || "document"}.pdf`;
}

export function openPrintDocument(input: DocTemplateInput) {
  return openPrintableDocument(buildDocumentHtml(input));
}

export function downloadPrintDocument(input: DocTemplateInput) {
  return downloadPrintableDocument(
    buildDocumentHtml(input),
    documentDownloadFilename(input)
  );
}
