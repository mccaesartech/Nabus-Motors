import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  isPasskeyRateLimited,
  passkeyRateLimitMessage,
} from "@/lib/admin/passkey-rate-limit";
import {
  createAuthenticationOptionsForLogin,
  isWebAuthnEnabled,
} from "@/lib/admin/webauthn";

export async function POST(req: NextRequest) {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: false, message: "Passkeys are not enabled." }, { status: 503 });
  }

  if (isPasskeyRateLimited(clientIp(req))) {
    return NextResponse.json({ ok: false, message: passkeyRateLimitMessage() }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;

  try {
    const { options, platformUserId } = await createAuthenticationOptionsForLogin(
      email || null,
      req.headers.get("origin")
    );
    return NextResponse.json({ ok: true, options, platformUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start passkey sign-in.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
