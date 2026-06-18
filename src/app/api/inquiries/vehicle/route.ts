import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, inquiryType, vehicleSlug, vehicleName, message } =
      body;

    if (!name || !email || !inquiryType) {
      return jsonError("Name, email, and inquiry type are required.", 400);
    }

    const result = await insertRow("vehicle_inquiries", {
      name,
      email,
      phone: phone ?? null,
      inquiry_type: inquiryType,
      vehicle_slug: vehicleSlug ?? null,
      vehicle_name: vehicleName ?? null,
      message: message ?? null,
      status: "new",
    });

    if (!result.ok) return jsonError("Could not save inquiry. Try WhatsApp or call us.");
    return jsonOk();
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
