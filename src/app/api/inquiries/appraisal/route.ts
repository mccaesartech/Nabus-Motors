import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { make, model, year, mileage, condition, sellerName, sellerPhone, notes } =
      body;

    if (!make || !model || !year || !mileage || !sellerName || !sellerPhone) {
      return jsonError("Please complete all required fields.", 400);
    }

    const result = await insertRow("appraisal_requests", {
      make,
      model,
      year: Number(year),
      mileage: Number(mileage),
      condition: condition ?? null,
      seller_name: sellerName,
      seller_phone: sellerPhone,
      notes: notes ?? null,
      status: "pending",
    });

    if (!result.ok) return jsonError("Could not save request. Try again or call us.");
    return jsonOk();
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
