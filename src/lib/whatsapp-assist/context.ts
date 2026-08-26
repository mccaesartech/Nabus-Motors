import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerExchangeRates } from "@/lib/currency/server-rates";
import type { ExchangeRateMap } from "@/lib/currency/rates";
import { fetchAdminCustomerDetail } from "@/lib/platform/customers-admin";
import { fetchAdminOrderDetail } from "@/lib/platform/orders-admin";
import { paymentStatusLabel, vehicleTitleFromRow, type PreorderInquiryRow } from "@/lib/platform/preorder";
import {
  freightQuoteStatusLabel,
  freightServiceLabel,
  type FreightQuoteRow,
} from "@/lib/platform/freight-quote-display";
import { shipmentStatusLabel, type ShipmentWithEvents } from "@/lib/platform/shipment";
import { formatPlatformPrice } from "@/lib/currency";
import {
  loadAutomatedWhatsAppHistory,
  loadPlatformMessageHistory,
  loadStaffWhatsAppHistory,
  mergeConversationHistory,
} from "@/lib/whatsapp-assist/history";
import type {
  WhatsAppAssistContextType,
  WhatsAppCustomerFacts,
  WhatsAppSuggestRequest,
} from "@/lib/whatsapp-assist/types";

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value == null || value === "") continue;
    if (typeof value === "string" && !value.trim()) continue;
    out[key] = value;
  }
  return out;
}

async function loadPreorderFocus(
  supabase: SupabaseClient,
  id: string
): Promise<{ focus: Record<string, unknown>; label: string } | null> {
  const { data } = await supabase.from("preorder_inquiries").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as PreorderInquiryRow;
  return {
    label: `Pre-order · ${row.reference_code ?? id.slice(0, 8).toUpperCase()}`,
    focus: compactRecord({
      type: "preorder",
      id: row.id,
      referenceCode: row.reference_code,
      status: row.status,
      paymentStatus: row.payment_status
        ? paymentStatusLabel(row.payment_status)
        : null,
      downPaymentUsd: row.down_payment_usd,
      vehicle: vehicleTitleFromRow(row),
      shippingHandling: row.shipping_handling,
      message: row.message,
      followUpNotes: row.follow_up_notes,
      isCustomRequest: row.is_custom_request,
      requestedMake: row.requested_make,
      requestedModel: row.requested_model,
      requestedYear: row.requested_year,
      createdAt: row.created_at,
    }),
  };
}

async function loadOrderFocus(
  supabase: SupabaseClient,
  id: string,
  rates: ExchangeRateMap
): Promise<{ focus: Record<string, unknown>; label: string } | null> {
  const order = await fetchAdminOrderDetail(supabase, id, { rates });
  if (!order) return null;
  return {
    label: `Cart order · ${id.slice(0, 8).toUpperCase()}`,
    focus: compactRecord({
      type: "order",
      id: order.id,
      status: order.status,
      total: order.totalLabel,
      itemCount: order.itemCount,
      vehicleCount: order.vehicleCount,
      partCount: order.partCount,
      confirmedAt: order.confirmedAt,
      notes: order.notes,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        intent: item.itemIntent,
        lineTotal: item.lineTotalLabel,
      })),
      appointment: order.appointment
        ? {
            preferredDate: order.appointment.preferredDate,
            preferredTime: order.appointment.preferredTime,
            status: order.appointment.status,
            branch: order.appointment.branch,
          }
        : null,
      createdAt: order.createdAt,
    }),
  };
}

async function loadQuoteFocus(
  supabase: SupabaseClient,
  id: string
): Promise<{ focus: Record<string, unknown>; label: string } | null> {
  const { data } = await supabase
    .from("freight_quote_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as FreightQuoteRow;
  return {
    label: `Freight quote · ${row.reference_code ?? id.slice(0, 8).toUpperCase()}`,
    focus: compactRecord({
      type: "quote",
      id: row.id,
      referenceCode: row.reference_code,
      status: freightQuoteStatusLabel(row.status),
      serviceType: freightServiceLabel(row.service_type),
      originCountry: row.origin_country,
      destination: row.destination,
      cargoDescription: row.cargo_description,
      cargoSize: row.cargo_size,
      estimatedValueUsd: row.estimated_value_usd,
      message: row.message,
      convertedShipmentId: row.converted_shipment_id,
      createdAt: row.created_at,
    }),
  };
}

async function loadShipmentFocus(
  supabase: SupabaseClient,
  id: string
): Promise<{ focus: Record<string, unknown>; label: string } | null> {
  const { data: shipment } = await supabase
    .from("shipment_tracking")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!shipment) return null;

  const { data: events } = await supabase
    .from("shipment_timeline_events")
    .select("title, description, location, event_at, event_type, is_customer_visible")
    .eq("shipment_id", id)
    .order("event_at", { ascending: false })
    .limit(8);

  const row = shipment as ShipmentWithEvents;
  return {
    label: `Shipment · ${row.tracking_number}`,
    focus: compactRecord({
      type: "shipment",
      id: row.id,
      trackingNumber: row.tracking_number,
      status: shipmentStatusLabel(row.status),
      referenceType: row.reference_type,
      originCountry: row.origin_country,
      destination: row.destination,
      vesselName: row.vessel_name,
      containerNumber: row.container_number,
      estimatedArrival: row.estimated_arrival,
      actualArrival: row.actual_arrival,
      notes: row.notes,
      recentEvents: (events ?? []).map((event) =>
        compactRecord({
          title: event.title,
          description: event.description,
          location: event.location,
          at: event.event_at,
          customerVisible: event.is_customer_visible,
        })
      ),
      createdAt: row.created_at,
    }),
  };
}

async function loadInquiryFocus(
  supabase: SupabaseClient,
  inquiryType: string,
  id: string
): Promise<{ focus: Record<string, unknown>; label: string } | null> {
  const tableMap: Record<string, string> = {
    vehicle: "vehicle_inquiries",
    appointment: "appointment_inquiries",
    finance: "finance_inquiries",
    appraisal: "appraisal_inquiries",
    price_alert: "price_alert_inquiries",
  };
  const table = tableMap[inquiryType];
  if (!table) return null;

  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  const record = data as Record<string, unknown>;
  return {
    label: `${inquiryType.replace(/_/g, " ")} inquiry · ${id.slice(0, 8).toUpperCase()}`,
    focus: compactRecord({
      type: "inquiry",
      inquiryType,
      id,
      status: record.status,
      source: record.source,
      message: record.message ?? record.notes ?? record.details,
      followUpNotes: record.follow_up_notes,
      createdAt: record.created_at,
      ...record,
    }),
  };
}

async function loadFocusRecord(
  supabase: SupabaseClient,
  contextType: WhatsAppAssistContextType | undefined,
  contextId: string | undefined,
  inquiryType: string | undefined,
  rates: ExchangeRateMap
): Promise<{ focus: Record<string, unknown> | null; label: string | null }> {
  if (!contextType || !contextId) {
    return { focus: null, label: null };
  }

  switch (contextType) {
    case "preorder":
      return (await loadPreorderFocus(supabase, contextId)) ?? { focus: null, label: null };
    case "order":
      return (await loadOrderFocus(supabase, contextId, rates)) ?? { focus: null, label: null };
    case "quote":
      return (await loadQuoteFocus(supabase, contextId)) ?? { focus: null, label: null };
    case "shipment":
      return (await loadShipmentFocus(supabase, contextId)) ?? { focus: null, label: null };
    case "inquiry":
      return inquiryType
        ? (await loadInquiryFocus(supabase, inquiryType, contextId)) ?? {
            focus: null,
            label: null,
          }
        : { focus: null, label: null };
    default:
      return { focus: null, label: null };
  }
}

export async function loadWhatsAppCustomerFacts(
  supabase: SupabaseClient,
  input: WhatsAppSuggestRequest
): Promise<WhatsAppCustomerFacts> {
  const phone = input.phone.trim();
  let name = input.customerName?.trim() || null;
  let email = input.email?.trim().toLowerCase() || null;
  let userId = input.userId?.trim() || null;
  let registrationId: string | null = null;
  let whatsappOptIn: boolean | null = null;
  let accountCreatedAt: string | null = null;
  const { rates } = await getServerExchangeRates();

  if (input.customerId?.trim()) {
    const customer = await fetchAdminCustomerDetail(supabase, input.customerId.trim(), { rates });
    if (customer) {
      name = name ?? customer.name;
      email = email ?? customer.email;
      userId = userId ?? customer.userId;
      registrationId = customer.registrationId;
      whatsappOptIn = customer.whatsappOptIn;
      accountCreatedAt = customer.accountCreatedAt;
    }
  }

  const { focus, label } = await loadFocusRecord(
    supabase,
    input.contextType,
    input.contextId,
    input.inquiryType,
    rates
  );

  let preorders: Array<Record<string, unknown>> = [];
  let orders: Array<Record<string, unknown>> = [];
  let quotes: Array<Record<string, unknown>> = [];
  let shipments: Array<Record<string, unknown>> = [];

  if (input.customerId?.trim()) {
    const customer = await fetchAdminCustomerDetail(supabase, input.customerId.trim(), { rates });
    if (customer) {
      preorders = customer.recentPreorders.map((p) =>
        compactRecord({
          id: p.id,
          referenceCode: p.referenceCode,
          status: p.status,
          vehicle: p.vehicleLabel,
          createdAt: p.createdAt,
        })
      );
      orders = customer.recentOrders.map((o) =>
        compactRecord({
          id: o.id,
          status: o.status,
          total: o.totalLabel,
          itemCount: o.itemCount,
          createdAt: o.createdAt,
        })
      );
      quotes = customer.recentQuotes.map((q) =>
        compactRecord({
          id: q.id,
          referenceCode: q.referenceCode,
          status: q.status,
          serviceType: q.serviceType,
          route: [q.originCountry, q.destination].filter(Boolean).join(" → "),
          createdAt: q.createdAt,
        })
      );
      shipments = customer.recentShipments.map((s) =>
        compactRecord({
          id: s.id,
          trackingNumber: s.trackingNumber,
          status: s.status,
          destination: s.destination,
          createdAt: s.createdAt,
        })
      );
    }
  }

  const [staffWhatsAppHistory, whatsappHistory, platformMessages] = await Promise.all([
    loadStaffWhatsAppHistory(supabase, phone),
    loadAutomatedWhatsAppHistory(supabase, phone),
    loadPlatformMessageHistory(supabase, userId, email),
  ]);

  return {
    customer: {
      name,
      email,
      phone,
      userId,
      registrationId,
      whatsappOptIn,
      accountCreatedAt,
    },
    focus,
    focusLabel: label,
    preorders,
    orders,
    quotes,
    shipments,
    platformMessages,
    whatsappHistory,
    staffWhatsAppHistory: input.conversationHistory?.length
      ? mergeConversationHistory(staffWhatsAppHistory, input.conversationHistory)
      : staffWhatsAppHistory,
  };
}

export function factsToPromptPayload(
  facts: WhatsAppCustomerFacts,
  options?: {
    mode?: "initial" | "reply";
    lastCustomerMessage?: string;
    staffInstructions?: string;
  }
): Record<string, unknown> {
  const conversation = mergeConversationHistory(
    facts.staffWhatsAppHistory,
    facts.whatsappHistory,
    facts.platformMessages
  );

  return {
    company: "True Goshen Auto (Ghana)",
    customer: facts.customer,
    focusRecord: facts.focus,
    focusLabel: facts.focusLabel,
    recentPreorders: facts.preorders.slice(0, 5),
    recentOrders: facts.orders.slice(0, 5),
    recentQuotes: facts.quotes.slice(0, 5),
    recentShipments: facts.shipments.slice(0, 5),
    conversationHistory: conversation.slice(-20),
    mode: options?.mode ?? "initial",
    lastCustomerMessage: options?.lastCustomerMessage?.trim() || null,
    staffInstructions: options?.staffInstructions?.trim() || null,
  };
}

export function inferMissingFields(facts: WhatsAppCustomerFacts): string[] {
  const missing: string[] = [];
  if (!facts.customer.name) missing.push("customer name");
  if (!facts.customer.email) missing.push("customer email");
  if (facts.customer.whatsappOptIn === false) {
    missing.push("WhatsApp opt-in (customer has not opted in)");
  }
  if (!facts.focus && facts.preorders.length === 0 && facts.orders.length === 0) {
    missing.push("specific inquiry or order to reference");
  }
  return missing;
}

export function formatDownPayment(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return formatPlatformPrice(Number(amount));
}
