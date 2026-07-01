import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, partId, partName, partSlug, sku, quantity, message } = body;

    if (!name || !email || !partName) {
      return jsonError("Name, email, and part are required.", 400);
    }

    const subject = `Parts request: ${partName}${sku ? ` (${sku})` : ""}`;
    const detailMessage = [
      `Part: ${partName}`,
      partSlug ? `Slug: ${partSlug}` : null,
      partId ? `ID: ${partId}` : null,
      sku ? `SKU: ${sku}` : null,
      `Quantity: ${quantity ?? 1}`,
      message ? `\nNotes: ${message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await insertRow("contact_inquiries", {
      name,
      email,
      phone: phone ?? null,
      subject,
      message: detailMessage,
      status: "new",
    });

    if (!result.ok) return jsonError("Could not save request. Try again or call us.");
    return jsonOk("Request submitted successfully.");
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
