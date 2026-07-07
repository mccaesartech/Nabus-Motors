import type { InquiryTab } from "@/lib/platform/types";

export type InquiryDetailType = "contact" | "vehicle" | "finance" | "appraisal";

export const INQUIRY_DETAIL_TYPES: InquiryDetailType[] = [
  "contact",
  "vehicle",
  "finance",
  "appraisal",
];

const INQUIRY_TABLE_MAP: Record<InquiryDetailType, string> = {
  contact: "contact_inquiries",
  vehicle: "vehicle_inquiries",
  finance: "finance_applications",
  appraisal: "appraisal_requests",
};

export function isInquiryDetailType(type: string): type is InquiryDetailType {
  return INQUIRY_DETAIL_TYPES.includes(type as InquiryDetailType);
}

export function inquiryTableForType(type: InquiryDetailType): string {
  return INQUIRY_TABLE_MAP[type];
}

export function leadDetailLink(
  type: Exclude<InquiryTab, "newsletter">,
  id: string
): string | undefined {
  if (type === "preorder") return `/platform/leads/preorder/${id}`;
  if (type === "order") return `/platform/leads/order/${id}`;
  if (isInquiryDetailType(type)) return `/platform/leads/${type}/${id}`;
  return undefined;
}

export function leadsListBackHref(type: string): string {
  return `/platform/leads?tab=${encodeURIComponent(type)}`;
}

export function inquiryDetailTitle(type: InquiryDetailType): string {
  switch (type) {
    case "contact":
      return "Contact inquiry";
    case "vehicle":
      return "Vehicle inquiry";
    case "finance":
      return "Finance application";
    case "appraisal":
      return "Trade-in appraisal";
  }
}

export function vehicleInquiryTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
