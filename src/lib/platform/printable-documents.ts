import {
  brandHeader,
  customerMetaGrid,
  detailTable,
  documentFooter,
  escapeHtml,
  formatPrintDate,
  formatPrintDateTime,
  sectionBlock,
  wrapDocument,
} from "@/lib/print/document-shell";
import { resolveOrderLinePricing } from "@/lib/print/order-line-pricing";
import { formatPlatformPrice } from "@/lib/currency";
import { FX_MARKET_DISCLAIMER, formatUsdGhsRateLine } from "@/lib/currency/meta";
import { ratesMapFromSnapshot, snapshotRateLabel } from "@/lib/currency/snapshot";
import {
  customRequestStatusLabel,
  formatBudgetRangeGhs,
  parseCustomRequestSpecs,
} from "@/lib/platform/custom-request";
import type { AdminCustomerDetail } from "@/lib/platform/customers-admin";
import {
  inquiryDetailTitle,
  vehicleInquiryTypeLabel,
  type InquiryDetailType,
} from "@/lib/platform/lead-detail";
import type { AdminOrderDetail } from "@/lib/platform/orders-admin";
import {
  paymentStatusLabel,
  type PreorderInquiryRow,
  vehicleTitleFromRow,
} from "@/lib/platform/preorder";
import { freightServiceLabel } from "@/lib/platform/freight-quote-display";
import { orderStatusLabel } from "@/lib/parts/order-labels";

type InquiryRecord = Record<string, unknown>;

function str(value: unknown): string {
  if (value == null || value === "") return "";
  return String(value);
}

function inquiryReference(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function inquiryCustomer(
  record: InquiryRecord,
  type: InquiryDetailType
): { name: string; email: string; phone?: string | null } {
  if (type === "finance") {
    return {
      name: `${str(record.first_name)} ${str(record.last_name)}`.trim() || "Unknown",
      email: str(record.email),
      phone: str(record.phone) || null,
    };
  }
  if (type === "appraisal") {
    return {
      name: str(record.seller_name) || "Unknown",
      email: "",
      phone: str(record.seller_phone) || null,
    };
  }
  return {
    name: str(record.name) || "Unknown",
    email: str(record.email),
    phone: str(record.phone) || null,
  };
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildInquiryDetails(type: InquiryDetailType, record: InquiryRecord): string {
  if (type === "contact") {
    return detailTable([
      ["Subject", str(record.subject) || "—"],
      ["Status", statusLabel(str(record.status) || "new")],
      ["Source", statusLabel(str(record.source) || "website")],
    ]);
  }

  if (type === "vehicle") {
    return detailTable([
      ["Inquiry type", vehicleInquiryTypeLabel(str(record.inquiry_type))],
      ["Vehicle", str(record.vehicle_name) || str(record.vehicle_slug) || "—"],
      ["Vehicle slug", str(record.vehicle_slug) || null],
      ["Status", statusLabel(str(record.status) || "new")],
      ["Source", statusLabel(str(record.source) || "website")],
    ]);
  }

  if (type === "finance") {
    return detailTable([
      ["Phone", str(record.phone) || "—"],
      ["Annual income", str(record.annual_income_range) || "—"],
      ["Credit score", str(record.credit_score_range) || "—"],
      ["Vehicle of interest", str(record.vehicle_of_interest) || "—"],
      ["Status", statusLabel(str(record.status) || "new")],
      ["Source", statusLabel(str(record.source) || "website")],
    ]);
  }

  return detailTable([
    ["Year", str(record.year) || "—"],
    ["Make", str(record.make) || "—"],
    ["Model", str(record.model) || "—"],
    [
      "Mileage",
      record.mileage != null ? `${Number(record.mileage).toLocaleString()} km` : "—",
    ],
    ["Condition", str(record.condition) || "—"],
    ["Status", statusLabel(str(record.status) || "new")],
    ["Source", statusLabel(str(record.source) || "website")],
  ]);
}

function inquiryMessage(type: InquiryDetailType, record: InquiryRecord): string | null {
  if (type === "contact" || type === "vehicle") return str(record.message) || null;
  if (type === "finance" || type === "appraisal") return str(record.notes) || null;
  return null;
}

export function buildInquiryDocumentHtml(
  type: InquiryDetailType,
  id: string,
  record: InquiryRecord
): string {
  const title = inquiryDetailTitle(type);
  const ref = inquiryReference(id);
  const customer = inquiryCustomer(record, type);
  const createdAt = str(record.created_at);
  const message = inquiryMessage(type, record);

  const metaExtra = `
    <div><dt>Date issued</dt><dd>${escapeHtml(formatPrintDateTime(createdAt))}</dd></div>
    <div><dt>Status</dt><dd>${escapeHtml(statusLabel(str(record.status) || "new"))}</dd></div>
    <div><dt>Inquiry ID</dt><dd style="font-family:ui-monospace,monospace;">${escapeHtml(id)}</dd></div>
  `;

  const details = buildInquiryDetails(type, record);
  const messageSection = message
    ? sectionBlock("Message", `<div class="message-block">${escapeHtml(message)}</div>`)
    : "";

  const body = `
    ${brandHeader(ref, "INQUIRY")}
    <h2 class="doc-title">${escapeHtml(title)}</h2>
    <p class="doc-subtitle">Issued ${escapeHtml(formatPrintDate(createdAt))}</p>
    ${sectionBlock("Customer", customerMetaGrid(customer, metaExtra))}
    ${sectionBlock("Inquiry details", details)}
    ${messageSection}
    ${documentFooter(type === "contact" ? "Thank you for your inquiry with" : "Thank you for choosing")}
  `;

  return wrapDocument(`${title} ${ref}`, body);
}

function adminItemTypeLabel(item: AdminOrderDetail["items"][number]): string {
  if (item.itemType === "vehicle") {
    return item.itemIntent === "pre_order" ? "Vehicle · Pre-order" : "Vehicle · Buy";
  }
  return item.sku ? `Part · SKU ${item.sku}` : "Spare part";
}

function fxFootnote(order: AdminOrderDetail): string {
  const snapshot = order.fxSnapshot;
  if (!snapshot) {
    return `<p class="payment-note">${escapeHtml(FX_MARKET_DISCLAIMER)}</p>`;
  }
  const label = snapshotRateLabel(snapshot);
  return `<p class="payment-note">Exchange rate used: ${escapeHtml(formatUsdGhsRateLine(snapshot.rateUsed))} · ${escapeHtml(label)} · ${escapeHtml(FX_MARKET_DISCLAIMER)}</p>`;
}

function renderAdminOrderItems(order: AdminOrderDetail): string {
  const rates = order.fxSnapshot ? ratesMapFromSnapshot(order.fxSnapshot) : undefined;
  const rows = order.items
    .map((item) => {
      const pricing = resolveOrderLinePricing(
        item.quantity,
        item.unitPriceUsd,
        item.unitPriceUsd * item.quantity,
        rates
      );

      return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-detail">${escapeHtml(adminItemTypeLabel(item))}</div>
          </td>
          <td class="num">${pricing.quantity}</td>
          <td class="num">${escapeHtml(pricing.unitPriceLabel)}</td>
          <td class="num">${escapeHtml(pricing.lineTotalLabel)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="items">
      <colgroup>
        <col />
        <col style="width:44px" />
        <col style="width:92px" />
        <col style="width:92px" />
      </colgroup>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit price (GHS)</th>
          <th class="num">Line total (GHS)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function buildAdminOrderDocumentHtml(order: AdminOrderDetail): string {
  const ref = order.id.slice(0, 8).toUpperCase();
  const customer = { name: order.name, email: order.email, phone: order.phone };

  const metaExtra = `
    <div><dt>Date placed</dt><dd>${escapeHtml(formatPrintDateTime(order.createdAt))}</dd></div>
    <div><dt>Status</dt><dd>${escapeHtml(orderStatusLabel(order.status))}</dd></div>
    <div><dt>Order ID</dt><dd style="font-family:ui-monospace,monospace;">${escapeHtml(order.id)}</dd></div>
    <div><dt>Items</dt><dd>${order.itemCount}</dd></div>
  `;

  const appointmentRow =
    order.appointment != null
      ? detailTable([
          ["Appointment date", order.appointment.preferredDate ?? "TBD"],
          ["Appointment time", order.appointment.preferredTime ?? "—"],
          ["Branch", order.appointment.branch ?? "—"],
          ["Appointment status", statusLabel(order.appointment.status)],
        ])
      : "";

  const body = `
    ${brandHeader(ref, "INVOICE")}
    <h2 class="doc-title">Cart Order</h2>
    <p class="doc-subtitle">Issued ${escapeHtml(formatPrintDate(order.createdAt))} · ${escapeHtml(order.totalLabel)}</p>
    ${sectionBlock("Customer", customerMetaGrid(customer, metaExtra))}
    ${sectionBlock("Line items", order.items.length > 0 ? renderAdminOrderItems(order) : "<p>No line items recorded.</p>")}
    <p class="total-row">Grand total: ${escapeHtml(order.totalLabel)}</p>
    ${fxFootnote(order)}
    ${appointmentRow ? sectionBlock("Linked appointment", appointmentRow) : ""}
    ${documentFooter()}
  `;

  return wrapDocument(`Order ${ref}`, body);
}

function shippingHandlingLabel(value?: string | null): string {
  if (value === "customer_arranged") return "Customer arranges shipping";
  if (value === "true_goshen") return "Nabus Motors handles freight & clearing";
  if (value === "consultation") return "Consultation requested";
  return "—";
}

export function buildAdminPreorderDocumentHtml(inquiry: PreorderInquiryRow): string {
  const isCustom = inquiry.is_custom_request === true;
  const ref = inquiry.reference_code ?? inquiry.id.slice(0, 8).toUpperCase();
  const vehicleTitle = vehicleTitleFromRow(inquiry);
  const customer = {
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
  };
  const createdAt = inquiry.created_at ?? new Date().toISOString();
  const downPayment =
    inquiry.down_payment_usd != null
      ? formatPlatformPrice(inquiry.down_payment_usd)
      : null;
  const vehiclePrice =
    inquiry.vehicle_price_usd != null
      ? formatPlatformPrice(inquiry.vehicle_price_usd)
      : null;

  const metaExtra = `
    <div><dt>Date issued</dt><dd>${escapeHtml(formatPrintDateTime(createdAt))}</dd></div>
    <div><dt>Status</dt><dd>${escapeHtml(statusLabel(inquiry.status ?? "new"))}</dd></div>
    <div><dt>Payment</dt><dd>${escapeHtml(paymentStatusLabel(inquiry.payment_status ?? "pending"))}</dd></div>
    ${downPayment ? `<div><dt>25% deposit</dt><dd>${escapeHtml(downPayment)}</dd></div>` : ""}
  `;

  let details: string;
  if (isCustom) {
    const specs = parseCustomRequestSpecs(inquiry.requested_specs);
    const budget = formatBudgetRangeGhs(inquiry.budget_min, inquiry.budget_max);
    details = detailTable([
      ["Vehicle", vehicleTitle],
      ["Make", inquiry.requested_make ?? null],
      ["Model", inquiry.requested_model ?? null],
      ["Year", inquiry.requested_year ?? null],
      ["Budget (GHS)", budget],
      ["Body type", specs.body_type ?? null],
      ["Fuel type", specs.fuel_type ?? null],
      ["Condition", specs.condition ?? null],
      ["Timeline", specs.preferred_timeline ?? null],
      ["Notes", specs.notes ?? null],
      ["Source", statusLabel(inquiry.source ?? "website")],
    ]);
  } else {
    details = detailTable([
      ["Vehicle", vehicleTitle],
      ["Vehicle price", vehiclePrice],
      ["Shipping", shippingHandlingLabel(inquiry.shipping_handling)],
      ["Source", statusLabel(inquiry.source ?? "website")],
    ]);
  }

  const message = inquiry.message?.trim()
    ? sectionBlock("Message", `<div class="message-block">${escapeHtml(inquiry.message.trim())}</div>`)
    : "";

  const docTitle = isCustom ? "Custom Vehicle Request" : "Pre-Order Inquiry";
  const docTypeLabel = isCustom ? "REQUEST" : "PRE-ORDER";

  const body = `
    ${brandHeader(ref, docTypeLabel)}
    <h2 class="doc-title">${escapeHtml(docTitle)}</h2>
    <p class="doc-subtitle">Issued ${escapeHtml(formatPrintDate(createdAt))}</p>
    ${sectionBlock("Customer", customerMetaGrid(customer, metaExtra))}
    ${sectionBlock(isCustom ? "Request details" : "Vehicle details", details)}
    ${message}
    ${!isCustom ? '<p style="font-size:13px;color:#555;margin:0 0 20px;">A 25% down payment secures this pre-order. Balance due before delivery.</p>' : ""}
    ${documentFooter()}
  `;

  return wrapDocument(`${docTitle} ${ref}`, body);
}

export function buildCustomerInvoiceDocumentHtml(customer: AdminCustomerDetail): string {
  const ref = customer.registrationId ?? customer.id.slice(0, 8).toUpperCase();
  const issuedAt = new Date().toISOString();

  const contactMeta = `
    <div><dt>Registration ID</dt><dd style="font-family:ui-monospace,monospace;">${escapeHtml(ref)}</dd></div>
    <div><dt>Date issued</dt><dd>${escapeHtml(formatPrintDateTime(issuedAt))}</dd></div>
    <div><dt>WhatsApp updates</dt><dd>${
      customer.whatsappOptIn === true
        ? "Opted in"
        : customer.whatsappOptIn === false
          ? "Not opted in"
          : "Not specified"
    }</dd></div>
    ${
      customer.accountCreatedAt
        ? `<div><dt>Account created</dt><dd>${escapeHtml(formatPrintDate(customer.accountCreatedAt))}</dd></div>`
        : ""
    }
  `;

  const activity = detailTable([
    ["Cart orders", String(customer.ordersCount)],
    ["Pre-orders", String(customer.preordersCount)],
    ["Freight quotes", String(customer.quotesCount)],
    ["Inquiries & applications", String(customer.inquiriesCount)],
    ["Shipments", String(customer.shipmentsCount)],
  ]);

  const orderSections = customer.recentOrders.slice(0, 10).map((order) => {
    const ref = order.id.slice(0, 8).toUpperCase();
    const itemRows = order.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.itemType === "vehicle" ? (item.itemIntent === "pre_order" ? "Vehicle · Pre-order" : "Vehicle · Buy") : "Part")}</td><td class="num">${item.quantity}</td><td class="num">${escapeHtml(item.lineTotalLabel)}</td></tr>`
      )
      .join("");
    const itemsTable =
      order.items.length > 0
        ? `<table class="items"><thead><tr><th>Item</th><th>Type</th><th class="num">Qty</th><th class="num">Line total</th></tr></thead><tbody>${itemRows}</tbody></table>`
        : "";
    const notesBlock = order.notes?.trim()
      ? `<p class="message-block"><strong>Notes:</strong> ${escapeHtml(order.notes.trim())}</p>`
      : "";
    return `
      <div style="margin-bottom:20px;">
        <p style="font-weight:600;margin:0 0 8px;">Order ${escapeHtml(ref)} · ${escapeHtml(orderStatusLabel(order.status))} · ${escapeHtml(order.totalLabel)} · ${escapeHtml(formatPrintDate(order.createdAt))}</p>
        ${itemsTable}
        ${notesBlock}
      </div>
    `;
  }).join("");

  const ordersTable =
    customer.recentOrders.length > 0 ? orderSections : "<p>No cart orders yet.</p>";

  const quoteRows = customer.recentQuotes
    .slice(0, 5)
    .map(
      (q) =>
        `<tr><td>${escapeHtml(q.referenceCode ?? "No reference")}</td><td>${escapeHtml(freightServiceLabel(q.serviceType))}</td><td>${escapeHtml(q.status)}</td><td>${escapeHtml([q.originCountry, q.destination].filter(Boolean).join(" → ") || "—")}</td><td>${escapeHtml(formatPrintDate(q.createdAt))}</td></tr>`
    )
    .join("");

  const quoteDetails = customer.recentQuotes
    .slice(0, 5)
    .map((q) => {
      const parts = [
        q.cargoDescription ? `Cargo: ${q.cargoDescription}` : null,
        q.cargoSize ? `Size: ${q.cargoSize}` : null,
        q.estimatedValueLabel ? `Est. value: ${q.estimatedValueLabel}` : null,
        q.message?.trim() ? `Message: ${q.message.trim()}` : null,
      ].filter(Boolean);
      if (parts.length === 0) return "";
      return `<p style="margin:8px 0 16px;font-size:13px;color:#555;"><strong>${escapeHtml(q.referenceCode ?? "Quote")}:</strong> ${escapeHtml(parts.join(" · "))}</p>`;
    })
    .join("");

  const quotesTable =
    customer.recentQuotes.length > 0
      ? `<table class="items"><thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Route</th><th>Date</th></tr></thead><tbody>${quoteRows}</tbody></table>${quoteDetails}`
      : "<p>No freight quotes yet.</p>";

  const preorderRows = customer.recentPreorders
    .slice(0, 5)
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.vehicleLabel ?? "Vehicle pre-order")}</td><td>${escapeHtml(p.referenceCode ?? "—")}</td><td>${escapeHtml(p.status)}</td><td>${escapeHtml(formatPrintDate(p.createdAt))}</td></tr>`
    )
    .join("");

  const preorderMessages = customer.recentPreorders
    .slice(0, 5)
    .map((p) =>
      p.message?.trim()
        ? `<p style="margin:8px 0 16px;font-size:13px;color:#555;"><strong>${escapeHtml(p.referenceCode ?? p.vehicleLabel ?? "Pre-order")}:</strong> ${escapeHtml(p.message.trim())}</p>`
        : ""
    )
    .join("");

  const preordersTable =
    customer.recentPreorders.length > 0
      ? `<table class="items"><thead><tr><th>Vehicle</th><th>Reference</th><th>Status</th><th>Date</th></tr></thead><tbody>${preorderRows}</tbody></table>${preorderMessages}`
      : "<p>No pre-orders yet.</p>";

  const inquiryRows = customer.recentInquiries
    .slice(0, 10)
    .map(
      (inquiry) =>
        `<tr><td>${escapeHtml(inquiry.type)}</td><td>${escapeHtml(inquiry.label)}</td><td>${escapeHtml(inquiry.summary || "—")}</td><td>${escapeHtml(inquiry.status)}</td><td>${escapeHtml(formatPrintDate(inquiry.createdAt))}</td></tr>`
    )
    .join("");

  const inquiriesTable =
    customer.recentInquiries.length > 0
      ? `<table class="items"><thead><tr><th>Type</th><th>Subject</th><th>Details</th><th>Status</th><th>Date</th></tr></thead><tbody>${inquiryRows}</tbody></table>`
      : "<p>No inquiries or applications yet.</p>";

  const body = `
    ${brandHeader(ref, "INVOICE")}
    <h2 class="doc-title">Customer Invoice</h2>
    <p class="doc-subtitle">Issued ${escapeHtml(formatPrintDate(issuedAt))} · ${escapeHtml(customer.name)}</p>
    ${sectionBlock("Bill to", customerMetaGrid(customer, contactMeta))}
    ${sectionBlock("Activity summary", activity)}
    ${sectionBlock("Cart orders", ordersTable)}
    ${sectionBlock("Pre-orders", preordersTable)}
    ${sectionBlock("Freight quotes", quotesTable)}
    ${sectionBlock("Inquiries & applications", inquiriesTable)}
    ${documentFooter("Thank you for choosing")}
  `;

  return wrapDocument(`Invoice ${ref}`, body);
}

/** @deprecated Use buildCustomerInvoiceDocumentHtml */
export function buildCustomerProfileDocumentHtml(customer: AdminCustomerDetail): string {
  return buildCustomerInvoiceDocumentHtml(customer);
}
