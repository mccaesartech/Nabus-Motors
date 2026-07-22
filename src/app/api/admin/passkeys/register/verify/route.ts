import { NextRequest, NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isWebAuthnEnabled, verifyRegistrationForUser } from "@/lib/admin/webauthn";

export async function POST(req: NextRequest) {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: false, message: "Passkeys are not enabled." }, { status: 503 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (auth.auth.type !== "user" || !auth.auth.userId) {
    return NextResponse.json(
      { ok: false, message: "Passkeys can only be registered by platform team accounts." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const response = body.response as RegistrationResponseJSON | undefined;
  const deviceName = typeof body.deviceName === "string" ? body.deviceName : null;

  if (!response) {
    return NextResponse.json({ ok: false, message: "Missing registration response." }, { status: 400 });
  }

  try {
    await verifyRegistrationForUser(
      auth.auth.userId,
      response,
      deviceName,
      req.headers.get("origin")
    );
    return NextResponse.json({ ok: true, message: "Passkey registered successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passkey registration failed.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
