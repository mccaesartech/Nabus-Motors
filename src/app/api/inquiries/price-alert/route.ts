import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, phone, vehicleId, vehicleSlug, vehicleName, priceUsd } = body;

    if (!email || !vehicleId || priceUsd == null) {
      return jsonError("Email, vehicle, and price are required.", 400);
    }

    let userId: string | null = null;
    try {
      const user = await getCustomerFromAuthHeader(
        req.headers.get("authorization")
      );
      userId = user?.id ?? null;
    } catch {
      // guest alert is fine
    }

    const result = await insertRow("price_alerts", {
      vehicle_id: String(vehicleId),
      vehicle_slug: vehicleSlug ?? null,
      vehicle_name: vehicleName ?? null,
      price_usd_at_signup: Number(priceUsd),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      user_id: userId,
      status: "active",
    });

    if (!result.ok) return jsonError("Could not save price alert. Try again later.");
    return jsonOk();
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
