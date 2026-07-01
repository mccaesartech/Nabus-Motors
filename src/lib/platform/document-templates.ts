import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";
import { formatPlatformPrice } from "@/lib/currency";

type DocTemplateInput = {
  docType: string;
  customerName: string;
  vehicleLabel: string;
  vehiclePrice?: number;
  company?: Record<string, string>;
};

function companyBlock(company: Record<string, string>) {
  return `
    <p><strong>${company.company_name}</strong></p>
    <p>${company.address}</p>
    <p>${company.phone} · ${company.email}</p>
  `;
}

function docTitle(docType: string) {
  if (docType === "sales_agreement") return "Sales Agreement";
  if (docType === "preorder_agreement") return "Pre-Order Agreement";
  if (docType === "invoice") return "Invoice";
  return "Document";
}

export function buildDocumentHtml({
  docType,
  customerName,
  vehicleLabel,
  vehiclePrice,
  company = DEFAULT_SITE_SETTINGS,
}: DocTemplateInput) {
  const title = docTitle(docType);
  const priceLine =
    vehiclePrice != null
      ? `<p><strong>Vehicle price:</strong> ${formatPlatformPrice(vehiclePrice)}</p>`
      : "";
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const body =
    docType === "invoice"
      ? `
        <h2>Invoice</h2>
        <p>Date: ${today}</p>
        <p>Bill to: <strong>${customerName || "Customer"}</strong></p>
        <p>Item: ${vehicleLabel}</p>
        ${priceLine}
        <p>Payment terms as agreed. Thank you for choosing ${company.company_name}.</p>
      `
      : docType === "preorder_agreement"
        ? `
        <h2>Pre-Order Agreement</h2>
        <p>Date: ${today}</p>
        <p>Customer: <strong>${customerName || "Customer"}</strong></p>
        <p>Vehicle: <strong>${vehicleLabel}</strong></p>
        ${priceLine}
        <p>A 25% down payment secures this pre-order. Balance due before delivery.</p>
        <p>Signatures:</p>
        <p>Customer: _________________________ &nbsp;&nbsp; Date: __________</p>
        <p>Dealer: _________________________ &nbsp;&nbsp; Date: __________</p>
      `
        : `
        <h2>Sales Agreement</h2>
        <p>Date: ${today}</p>
        <p>Buyer: <strong>${customerName || "Customer"}</strong></p>
        <p>Vehicle: <strong>${vehicleLabel}</strong></p>
        ${priceLine}
        <p>The buyer agrees to purchase the above vehicle under True Goshen Auto terms and conditions.</p>
        <p>Buyer: _________________________ &nbsp;&nbsp; Date: __________</p>
        <p>Seller: _________________________ &nbsp;&nbsp; Date: __________</p>
      `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — ${company.company_name}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; color: #111; line-height: 1.6; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 24px; }
    .header { border-bottom: 2px solid #6b21a8; padding-bottom: 16px; margin-bottom: 24px; }
    @media print { body { margin: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${company.company_name}</h1>
    ${companyBlock(company)}
  </div>
  ${body}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

export function openPrintDocument(input: DocTemplateInput) {
  const html = buildDocumentHtml(input);
  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
