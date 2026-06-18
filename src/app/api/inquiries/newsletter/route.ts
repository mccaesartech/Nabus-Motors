import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) return jsonError("Email is required.", 400);

    const result = await insertRow("newsletter_subscribers", { email });

    if (!result.ok) return jsonError("Could not subscribe. Try again later.");
    return jsonOk();
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
