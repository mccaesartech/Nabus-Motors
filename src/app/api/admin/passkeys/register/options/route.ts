import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/errors/api";
import { requireAdmin } from "@/lib/admin/auth";
import { createRegistrationOptionsForUser, isWebAuthnEnabled } from "@/lib/admin/webauthn";

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

  try {
    const { options } = await createRegistrationOptionsForUser(
      auth.auth.userId,
      auth.auth.email,
      auth.auth.name,
      req.headers.get("origin")
    );
    return NextResponse.json({ ok: true, options });
  } catch (error) {
    return apiFailure(error, {
      module: "api.admin.passkeys.register.options.POST",
      message: "Could not start passkey registration.",
      request: req,
    });
  }
}
