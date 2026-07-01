import type { SupabaseClient } from "@supabase/supabase-js";
import type { InquiryData, InquiryTab, UnifiedLead } from "@/lib/platform/types";
import {
  type PreorderInquiryRow,
  normalizeVehicle,
  vehicleImageFromRow,
  vehicleTitleFromRow,
} from "@/lib/platform/preorder";
import { formatPlatformPrice } from "@/lib/currency";
import {
  buildCustomVehicleTitle,
  formatBudgetRangeGhs,
} from "@/lib/platform/custom-request";

const PREORDER_VEHICLE_SELECT = `
  *,
  vehicle:vehicles (
    id, year, make, model, trim, slug, price, images, status
  )
`;

export async function fetchPreorderInquiries(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("preorder_inquiries")
    .select(PREORDER_VEHICLE_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[fetchPreorderInquiries]", error.message);
    return [];
  }

  return (data ?? []) as PreorderInquiryRow[];
}

export async function fetchAllPreorderInquiries(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("preorder_inquiries")
    .select(PREORDER_VEHICLE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`preorder_inquiries: ${error.message}`);
  }

  return (data ?? []) as PreorderInquiryRow[];
}

export async function fetchPreorderInquiryById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("preorder_inquiries")
    .select(PREORDER_VEHICLE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[fetchPreorderInquiryById]", error.message);
    return null;
  }

  return data as PreorderInquiryRow | null;
}

function inquiryName(row: Record<string, unknown>, tab: InquiryTab): string {
  if (tab === "finance") {
    return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unknown";
  }
  if (tab === "appraisal") {
    return String(row.seller_name ?? "Unknown");
  }
  return String(row.name ?? "Unknown");
}

function inquiryEmail(row: Record<string, unknown>, tab: InquiryTab): string {
  if (tab === "appraisal") return String(row.seller_phone ?? "");
  return String(row.email ?? "");
}

function inquiryPhone(row: Record<string, unknown>, tab: InquiryTab): string | undefined {
  if (tab === "contact" || tab === "vehicle" || tab === "preorder" || tab === "order") {
    return String(row.phone ?? "") || undefined;
  }
  if (tab === "finance") return String(row.phone ?? "") || undefined;
  if (tab === "appraisal") return String(row.seller_phone ?? "") || undefined;
  return undefined;
}

function inquirySummary(row: Record<string, unknown>, tab: InquiryTab): string {
  if (tab === "contact") {
    return `${row.subject ? `${row.subject} — ` : ""}${String(row.message ?? "").slice(0, 120)}`;
  }
  if (tab === "vehicle") {
    return `${row.inquiry_type} — ${row.vehicle_name ?? row.vehicle_slug ?? "General"}`;
  }
  if (tab === "finance") {
    return `Finance · ${row.vehicle_of_interest ?? "No vehicle specified"}`;
  }
  if (tab === "appraisal") {
    return `Trade-in · ${row.year} ${row.make} ${row.model}`;
  }
  if (tab === "preorder") {
    const preorderRow = row as PreorderInquiryRow;
    if (preorderRow.is_custom_request) {
      const title = vehicleTitleFromRow(preorderRow);
      const budget = formatBudgetRangeGhs(
        preorderRow.budget_min,
        preorderRow.budget_max
      );
      const ref = preorderRow.reference_code
        ? ` · ${preorderRow.reference_code}`
        : "";
      return `Custom · ${title}${budget ? ` · ${budget}` : ""}${ref}`;
    }
    const vehicleLabel = vehicleTitleFromRow(preorderRow);
    const down = row.down_payment_usd
      ? `${formatPlatformPrice(Number(row.down_payment_usd))} down`
      : "25% down";
    return `${vehicleLabel} · ${down}`;
  }
  if (tab === "order") {
    const total = row.total_label
      ? String(row.total_label)
      : row.total_usd != null
        ? formatPlatformPrice(Number(row.total_usd))
        : "—";
    const items = Number(row.item_count ?? 0);
    return `Cart order · ${items} item${items === 1 ? "" : "s"} · ${total}`;
  }
  return "";
}

const LEAD_TABS: Exclude<InquiryTab, "newsletter">[] = [
  "contact",
  "vehicle",
  "finance",
  "appraisal",
  "preorder",
  "order",
];

function vehicleLabelFromRow(row: Record<string, unknown>, tab: InquiryTab): string | undefined {
  if (tab === "preorder") {
    return vehicleTitleFromRow(row as PreorderInquiryRow);
  }
  if (tab === "vehicle") {
    const name = row.vehicle_name ?? row.vehicle_slug;
    return name ? String(name) : undefined;
  }
  return undefined;
}

export function unifyLeads(data: InquiryData): UnifiedLead[] {
  const leads: UnifiedLead[] = [];

  for (const tab of LEAD_TABS) {
    const rows = data[tab] ?? [];
    for (const row of rows) {
      const preorderRow = tab === "preorder" ? (row as PreorderInquiryRow) : null;
      leads.push({
        id: String(row.id),
        type: tab,
        name: inquiryName(row, tab),
        email: inquiryEmail(row, tab),
        phone: inquiryPhone(row, tab),
        summary: inquirySummary(row, tab),
        status: String(row.status ?? "new"),
        source: String(row.source ?? "website"),
        followUpNotes:
          tab === "order"
            ? row.notes
              ? String(row.notes)
              : row.follow_up_notes
                ? String(row.follow_up_notes)
                : undefined
            : row.follow_up_notes
              ? String(row.follow_up_notes)
              : undefined,
        createdAt: String(row.created_at ?? ""),
        vehicleTitle: vehicleLabelFromRow(row, tab),
        vehicleImage: preorderRow ? vehicleImageFromRow(preorderRow) : undefined,
        detailLink:
          tab === "preorder"
            ? `/platform/leads/preorder/${String(row.id)}`
            : tab === "order"
              ? `/platform/leads/order/${String(row.id)}`
              : undefined,
        paymentStatus:
          tab === "preorder"
            ? (String(row.payment_status ?? "pending") as UnifiedLead["paymentStatus"])
            : undefined,
        isCustomRequest: preorderRow?.is_custom_request === true,
        referenceCode: preorderRow?.reference_code
          ? String(preorderRow.reference_code)
          : undefined,
      });
    }
  }

  return leads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function aggregateCustomers(
  data: InquiryData,
  profiles?: Array<{ email?: string | null; registration_id?: string | null }>
) {
  const registrationByEmail = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (profile.email && profile.registration_id) {
      registrationByEmail.set(profile.email.toLowerCase(), profile.registration_id);
    }
  }

  const map = new Map<
    string,
    {
      email: string;
      name: string;
      phone?: string;
      source: string;
      leadCount: number;
      lastContact: string;
      status: string;
      registrationId?: string;
    }
  >();

  for (const lead of unifyLeads(data)) {
    const key = lead.email.toLowerCase() || lead.id;
    const registrationId =
      registrationByEmail.get(lead.email.toLowerCase()) ??
      (lead.type === "preorder"
        ? String(
            (data.preorder ?? []).find((r) => String(r.id) === lead.id)
              ?.customer_registration_id ?? ""
          ) || undefined
        : undefined);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        email: lead.email,
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        leadCount: 1,
        lastContact: lead.createdAt,
        status: lead.status === "closed" || lead.status === "sold" ? "inactive" : "active",
        registrationId,
      });
    } else {
      existing.leadCount += 1;
      if (!existing.registrationId && registrationId) {
        existing.registrationId = registrationId;
      }
      if (new Date(lead.createdAt) > new Date(existing.lastContact)) {
        existing.lastContact = lead.createdAt;
        existing.name = lead.name || existing.name;
        existing.phone = lead.phone || existing.phone;
      }
    }
  }

  return Array.from(map.entries()).map(([id, c]) => ({
    id,
    ...c,
  }));
}

const VEHICLE_CSV_HEADERS = [
  "id",
  "make",
  "model",
  "year",
  "price",
  "mileage",
  "status",
  "body_type",
  "transmission",
  "fuel_type",
  "location",
  "featured",
  "vin",
] as const;

export function exportVehiclesCsv(
  vehicles: Array<{
    id?: string;
    make?: string;
    model?: string;
    year?: number;
    price?: number;
    mileage?: number;
    status?: string;
    body_type?: string;
    transmission?: string;
    fuel_type?: string;
    location?: string;
    featured?: boolean;
    vin?: string | null;
  }>
) {
  return toCsv(
    [...VEHICLE_CSV_HEADERS],
    vehicles.map((v) => ({
      id: v.id ?? "",
      make: v.make ?? "",
      model: v.model ?? "",
      year: v.year ?? "",
      price: v.price ?? "",
      mileage: v.mileage ?? "",
      status: v.status ?? "",
      body_type: v.body_type ?? "",
      transmission: v.transmission ?? "",
      fuel_type: v.fuel_type ?? "",
      location: v.location ?? "",
      featured: v.featured ?? "",
      vin: v.vin ?? "",
    }))
  );
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  if (!rows.length) return headers.join(",") + "\n";
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export function exportLeadsCsv(leads: UnifiedLead[]) {
  return toCsv(
    ["id", "type", "name", "email", "phone", "status", "source", "summary", "created_at"],
    leads.map((l) => ({
      id: l.id,
      type: l.type,
      name: l.name,
      email: l.email,
      phone: l.phone ?? "",
      status: l.status,
      source: l.source,
      summary: l.summary,
      created_at: l.createdAt,
    }))
  );
}

export function exportPreordersCsv(rows: PreorderInquiryRow[]) {
  return toCsv(
    [
      "id",
      "name",
      "email",
      "phone",
      "vehicle_title",
      "vehicle_slug",
      "customer_registration_id",
      "down_payment_usd",
      "payment_status",
      "status",
      "created_at",
    ],
    rows.map((r) => {
      const vehicle = normalizeVehicle(r.vehicle);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone ?? "",
        vehicle_title: vehicleTitleFromRow(r),
        vehicle_slug: r.vehicle_slug ?? vehicle?.slug ?? "",
        customer_registration_id: r.customer_registration_id ?? "",
        down_payment_usd: r.down_payment_usd ?? "",
        payment_status: r.payment_status ?? "",
        status: r.status ?? "",
        created_at: r.created_at ?? "",
      };
    })
  );
}
