import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !message) {
      return jsonError("Name, email, and message are required.", 400);
    }

    const result = await insertRow("contact_inquiries", {
      name,
      email,
      phone: phone ?? null,
      subject: subject ?? null,
      message,
      status: "new",
    });

    if (!result.ok) return jsonError("Could not save inquiry. Try again or call us.");
    return jsonOk();
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
