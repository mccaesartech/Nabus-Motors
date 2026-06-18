import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      annualIncomeRange,
      creditScoreRange,
      vehicleOfInterest,
      notes,
    } = body;

    if (!firstName || !lastName || !email || !phone) {
      return jsonError("Please complete all required fields.", 400);
    }

    const result = await insertRow("finance_applications", {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      annual_income_range: annualIncomeRange ?? null,
      credit_score_range: creditScoreRange ?? null,
      vehicle_of_interest: vehicleOfInterest ?? null,
      notes: notes ?? null,
      status: "pending",
    });

    if (!result.ok) return jsonError("Could not save application. Try again or call us.");
    return jsonOk();
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
