import { describe, expect, it } from "vitest";
import {
  PREORDER_VEHICLE_SELECT,
  exportLeadsCsv,
  exportPreordersCsv,
} from "@/lib/platform/data";
import type { UnifiedLead } from "@/lib/platform/types";
import type { PreorderInquiryRow } from "@/lib/platform/preorder";

describe("preorder vehicle select", () => {
  it("disambiguates the vehicles embed via vehicle_id FK hint", () => {
    expect(PREORDER_VEHICLE_SELECT).toContain("vehicles!vehicle_id");
    expect(PREORDER_VEHICLE_SELECT).not.toMatch(/vehicle:vehicles\s*\(/);
  });
});

describe("export CSV helpers", () => {
  it("exports leads with expected headers", () => {
    const leads: UnifiedLead[] = [
      {
        id: "1",
        type: "contact",
        name: "Ada",
        email: "ada@example.com",
        phone: "024",
        status: "new",
        source: "website",
        summary: "Hello",
        createdAt: "2026-01-01T00:00:00.000Z",
        detailLink: "/platform/leads/contact/1",
      },
    ];
    const csv = exportLeadsCsv(leads);
    expect(csv.split("\n")[0]).toBe(
      "id,type,name,email,phone,status,source,summary,created_at"
    );
    expect(csv).toContain("Ada");
  });

  it("exports preorders including custom requests without joined vehicle", () => {
    const rows: PreorderInquiryRow[] = [
      {
        id: "p1",
        name: "Kojo",
        email: "kojo@example.com",
        is_custom_request: true,
        requested_make: "Toyota",
        requested_model: "Land Cruiser",
        requested_year: "2024",
        payment_status: "pending",
        status: "new",
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ];
    const csv = exportPreordersCsv(rows);
    expect(csv).toContain("vehicle_title");
    expect(csv).toContain("Toyota");
    expect(csv).toContain("Land Cruiser");
  });
});