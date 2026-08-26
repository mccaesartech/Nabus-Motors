import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";
import {
  formatPlatformPrice,
  FX_MARKET_DISCLAIMER,
  formatUsdGhsRateLine,
  getActiveRates,
  rateSourceLabel,
} from "@/lib/currency";
import {
  brandHeader,
  documentFooter,
  escapeHtml,
  openPrintableDocument,
  wrapDocument,
} from "@/lib/print/document-shell";

type DocTemplateInput = {
  docType: string;
  customerName: string;
  vehicleLabel: string;
  vehiclePrice?: number;
  company?: Record<string, string>;
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

export function buildDocumentHtml({
  docType,
  customerName,
  vehicleLabel,
  vehiclePrice,
  company = DEFAULT_SITE_SETTINGS,
}: DocTemplateInput) {
  const title = docTitle(docType);
  const rates = getActiveRates();
  const ghsPerUsd = rates.GHS ?? 0;
  const priceLine =
    vehiclePrice != null
      ? `<p><strong>Vehicle price:</strong> ${formatPlatformPrice(vehiclePrice, rates)}</p>
         <p style="font-size:12px;color:#555;">Exchange rate used: ${formatUsdGhsRateLine(ghsPerUsd)} · ${rateSourceLabel({ source: "exchangerate-api" })}. ${FX_MARKET_DISCLAIMER}</p>`
      : "";
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const safeCustomer = escapeHtml(customerName || "Customer");
  const safeVehicle = escapeHtml(vehicleLabel);

  const body =
    docType === "invoice"
      ? `
        <h2 class="doc-title">Invoice</h2>
        <p class="doc-subtitle">Date: ${today}</p>
        <p>Bill to: <strong>${safeCustomer}</strong></p>
        <p>Item: ${safeVehicle}</p>
        ${priceLine}
        <p>Payment terms as agreed. Thank you for choosing ${escapeHtml(company.company_name)}.</p>
      `
      : docType === "preorder_agreement"
        ? `
        <h2 class="doc-title">Pre-Order Agreement</h2>
        <p class="doc-subtitle">Date: ${today}</p>
        <p>Customer: <strong>${safeCustomer}</strong></p>
        <p>Vehicle: <strong>${safeVehicle}</strong></p>
        ${priceLine}
        <p>A 25% down payment secures this pre-order. Balance due before delivery.</p>
        <p>Signatures:</p>
        <p>Customer: _________________________ &nbsp;&nbsp; Date: __________</p>
        <p>Dealer: _________________________ &nbsp;&nbsp; Date: __________</p>
      `
        : `
        <h2 class="doc-title">Sales Agreement</h2>
        <p class="doc-subtitle">Date: ${today}</p>
        <p>Buyer: <strong>${safeCustomer}</strong></p>
        <p>Vehicle: <strong>${safeVehicle}</strong></p>
        ${priceLine}
        <p>The buyer agrees to purchase the above vehicle under True Goshen Auto terms and conditions.</p>
        <p>Buyer: _________________________ &nbsp;&nbsp; Date: __________</p>
        <p>Seller: _________________________ &nbsp;&nbsp; Date: __________</p>
      `;

  return wrapDocument(
    title,
    `
      ${brandHeader(undefined, docTypeLabel(docType))}
      ${body}
      ${documentFooter()}
    `
  );
}

export function openPrintDocument(input: DocTemplateInput) {
  return openPrintableDocument(buildDocumentHtml(input));
}
