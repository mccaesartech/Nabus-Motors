import {
  absoluteAssetUrl,
  billToAndDetails,
  brandHeader,
  detailTable,
  documentFooter,
  escapeHtml,
  formatPrintDate,
  openPrintableDocument,
  printPrintableDocument,
  downloadPrintableDocument,
  renderTotalsBox,
  sectionBlock,
  wrapDocument,
} from "@/lib/print/document-shell";
import { resolveOrderLinePricing } from "@/lib/print/order-line-pricing";
import { orderReferenceId } from "@/lib/account/types";
import { formatPlatformPrice } from "@/lib/currency";
import {
  customRequestStatusLabel,
  formatBudgetRangeGhs,
  parseCustomRequestSpecs,
} from "@/lib/platform/custom-request";
import { orderStatusLabel } from "@/lib/parts/order-labels";
import type { PartsOrderItemSummary, PartsOrderSummary } from "@/lib/parts/cart-types";
import type { CustomerInquirySummary } from "@/lib/customer/types";

export type CustomerPrintProfile = {
  name: string;
  email: string;
  phone?: string | null;
};

export { openPrintableDocument, printPrintableDocument, downloadPrintableDocument };

function itemTypeLabel(item: PartsOrderItemSummary): string {
  if (item.item_type === "vehicle") {
    return item.item_intent === "pre_order" ? "Vehicle · Pre-order" : "Vehicle · Buy";
  }
  return item.sku ? `Part · SKU ${item.sku}` : "Spare part";
}

function renderOrderItemsTable(items: PartsOrderItemSummary[]): string {
  const rows = items
    .map((item) => {
      const thumb = absoluteAssetUrl(item.image_url);
      const thumbCell = thumb
        ? `<img class="item-thumb" src="${escapeHtml(thumb)}" alt="" crossorigin="anonymous" />`
        : `<div class="item-thumb-placeholder" aria-hidden="true"></div>`;
      const pricing = resolveOrderLinePricing(item.quantity, item.unit_price_usd);

      return `
        <tr>
          <td>${thumbCell}</td>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-detail">${escapeHtml(itemTypeLabel(item))}</div>
          </td>
          <td class="num">${pricing.quantity}</td>
          <td class="num">${escapeHtml(pricing.unitPriceLabel)}</td>
          <td class="num">${escapeHtml(pricing.lineTotalLabel)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="items items--with-thumb">
      <colgroup>
        <col style="width:40px" />
        <col />
        <col style="width:44px" />
        <col style="width:92px" />
        <col style="width:92px" />
      </colgroup>
      <thead>
        <tr>
          <th></th>
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

function orderPaymentNote(status: string): string | null {
  if (status === "pending") {
    return "This order is pending confirmation. Our team will contact you regarding payment and delivery arrangements.";
  }
  if (status === "confirmed") {
    return "Order confirmed. Payment and delivery as agreed with our sales team.";
  }
  if (status === "cancelled") {
    return "This order has been cancelled. Contact us if you have questions.";
  }
  return null;
}

export function buildOrderDocumentHtml(
  order: PartsOrderSummary,
  customer: CustomerPrintProfile
): string {
  const refId = orderReferenceId(order.id);
  const items = order.items ?? [];
  const subtotalUsd = items.reduce((sum, item) => {
    const pricing = resolveOrderLinePricing(item.quantity, item.unit_price_usd);
    return sum + pricing.lineTotalUsd;
  }, 0);
  const paymentNote = orderPaymentNote(order.status);

  const detailsHtml = `
    <dt>Date issued</dt>
    <dd>${escapeHtml(formatPrintDate(order.created_at))}</dd>
    <dt>Order status</dt>
    <dd>${escapeHtml(orderStatusLabel(order.status))}</dd>
    <dt>Line items</dt>
    <dd>${order.item_count}</dd>
  `;

  const totalsRows = [
    { label: "Subtotal", value: formatPlatformPrice(subtotalUsd) },
    { label: "Grand total", value: formatPlatformPrice(order.total_usd), emphasis: true },
  ];

  const body = `
    ${brandHeader(refId, "INVOICE")}
    ${billToAndDetails(customer, detailsHtml)}
    ${sectionBlock(
      "Line items",
      items.length > 0
        ? renderOrderItemsTable(items)
        : '<p class="empty-note">No line items recorded for this order.</p>'
    )}
    ${renderTotalsBox(totalsRows)}
    ${paymentNote ? `<p class="payment-note">${escapeHtml(paymentNote)}</p>` : ""}
    ${documentFooter()}
  `;

  return wrapDocument(`Invoice ${refId}`, body);
}

function paymentStatusLabel(status?: string): string {
  if (status === "down_payment_paid") return "25% deposit paid";
  if (status === "completed") return "Paid in full";
  if (status === "cancelled") return "Cancelled";
  return "Awaiting 25% deposit";
}

function preorderPaymentNote(status?: string): string {
  if (status === "down_payment_paid") {
    return "Your 25% deposit has been received. The remaining balance is due before delivery.";
  }
  if (status === "completed") {
    return "Pre-order paid in full. Our team will keep you updated on sourcing and delivery.";
  }
  if (status === "cancelled") {
    return "This pre-order has been cancelled. Contact us if you have questions.";
  }
  return "A 25% down payment secures this pre-order. Balance due before delivery.";
}

function renderPreorderLineItem(
  title: string,
  vehiclePriceUsd?: number | null,
  downPaymentUsd?: number | null
): string {
  if (vehiclePriceUsd == null && downPaymentUsd == null) return "";

  const price = vehiclePriceUsd ?? 0;
  const down = downPaymentUsd ?? 0;
  const balance = Math.max(price - down, 0);

  return `
    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Vehicle price</th>
          <th class="num">25% deposit</th>
          <th class="num">Balance due</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="item-name">${escapeHtml(title)}</div>
            <div class="item-detail">Vehicle pre-order</div>
          </td>
          <td class="num">${vehiclePriceUsd != null ? formatPlatformPrice(vehiclePriceUsd) : "—"}</td>
          <td class="num">${downPaymentUsd != null ? formatPlatformPrice(downPaymentUsd) : "—"}</td>
          <td class="num">${vehiclePriceUsd != null ? formatPlatformPrice(balance) : "—"}</td>
        </tr>
      </tbody>
    </table>
  `;
}

export function buildPreorderDocumentHtml(
  preorder: CustomerInquirySummary,
  customer: CustomerPrintProfile,
  options?: { orderStatus?: string }
): string {
  const ref = preorder.reference_code ?? preorder.id.slice(0, 8).toUpperCase();
  const orderStatus = options?.orderStatus ?? preorder.status;

  const detailsHtml = `
    <dt>Date submitted</dt>
    <dd>${escapeHtml(formatPrintDate(preorder.created_at))}</dd>
    <dt>Payment status</dt>
    <dd>${escapeHtml(paymentStatusLabel(preorder.payment_status))}</dd>
    <dt>Order status</dt>
    <dd>${escapeHtml(orderStatus)}</dd>
  `;

  const lineItems = renderPreorderLineItem(
    preorder.title,
    preorder.vehicle_price_usd,
    preorder.down_payment_usd
  );

  const totalsRows: Array<{ label: string; value: string; emphasis?: boolean }> = [];
  if (preorder.vehicle_price_usd != null) {
    totalsRows.push({
      label: "Vehicle price",
      value: formatPlatformPrice(preorder.vehicle_price_usd),
    });
  }
  if (preorder.down_payment_usd != null) {
    totalsRows.push({
      label: "25% deposit",
      value: formatPlatformPrice(preorder.down_payment_usd),
    });
    if (preorder.vehicle_price_usd != null) {
      totalsRows.push({
        label: "Balance due",
        value: formatPlatformPrice(
          Math.max(preorder.vehicle_price_usd - preorder.down_payment_usd, 0)
        ),
      });
    }
  }

  const body = `
    ${brandHeader(ref, "PRE-ORDER")}
    ${billToAndDetails(customer, detailsHtml)}
    ${lineItems ? sectionBlock("Vehicle", lineItems) : sectionBlock("Vehicle", detailTable([["Vehicle", preorder.title]]))}
    ${totalsRows.length > 0 ? renderTotalsBox(totalsRows) : ""}
    <p class="payment-note">${escapeHtml(preorderPaymentNote(preorder.payment_status))}</p>
    ${documentFooter()}
  `;

  return wrapDocument(`Pre-order ${ref}`, body);
}

export function buildCustomRequestDocumentHtml(
  request: CustomerInquirySummary,
  customer: CustomerPrintProfile
): string {
  const specs = parseCustomRequestSpecs(request.requested_specs);
  const budget = formatBudgetRangeGhs(request.budget_min, request.budget_max);
  const ref = request.reference_code ?? request.id.slice(0, 8).toUpperCase();
  const vehicleLabel =
    [request.requested_year, request.requested_make, request.requested_model]
      .filter(Boolean)
      .join(" ") || request.title.replace(/^Custom request — /, "");

  const detailsHtml = `
    <dt>Date submitted</dt>
    <dd>${escapeHtml(formatPrintDate(request.created_at))}</dd>
    <dt>Status</dt>
    <dd>${escapeHtml(customRequestStatusLabel(request.status))}</dd>
    <dt>Reference</dt>
    <dd style="font-family:ui-monospace,monospace;">${escapeHtml(ref)}</dd>
  `;

  const specDetails = detailTable([
    ["Vehicle", vehicleLabel],
    ["Make", request.requested_make],
    ["Model", request.requested_model],
    ["Year", request.requested_year],
    ["Budget (GHS)", budget],
    ["Body type", specs.body_type],
    ["Fuel type", specs.fuel_type],
    ["Condition", specs.condition],
    ["Timeline", specs.preferred_timeline],
    ["Notes", specs.notes],
  ]);

  const body = `
    ${brandHeader(ref, "REQUEST")}
    ${billToAndDetails(customer, detailsHtml)}
    ${sectionBlock("Request specifications", specDetails || '<p class="empty-note">No additional specifications recorded.</p>')}
    <p class="payment-note">
      This is a sourcing request, not a purchase invoice. Our team will review your requirements and contact you with availability and pricing.
    </p>
    ${documentFooter("Thank you for your inquiry with")}
  `;

  return wrapDocument(`Request ${ref}`, body);
}
