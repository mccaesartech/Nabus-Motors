import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/errors/api";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { buildPlatformLoginResponse } from "@/lib/admin/platform-login";
import {
  clientIp,
  isPasskeyRateLimited,
  passkeyRateLimitMessage,
} from "@/lib/admin/passkey-rate-limit";
import { isWebAuthnEnabled, verifyAuthenticationForLogin } from "@/lib/admin/webauthn";

export async function POST(req: NextRequest) {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: false, message: "Passkeys are not enabled." }, { status: 503 });
  }

  if (isPasskeyRateLimited(clientIp(req))) {
    return NextResponse.json({ ok: false, message: passkeyRateLimitMessage() }, { status: 429 });
  }

  const body = await req.json();
  const response = body.response as AuthenticationResponseJSON | undefined;
  const platformUserId =
    typeof body.platformUserId === "string" ? body.platformUserId : null;

  if (!response) {
    return NextResponse.json({ ok: false, message: "Missing authentication response." }, { status: 400 });
  }

  try {
    const user = await verifyAuthenticationForLogin(
      response,
      platformUserId,
      req.headers.get("origin")
    );
    return buildPlatformLoginResponse(user);
  } catch (error) {
    return apiFailure(error, {
      module: "api.admin.passkeys.login.verify.POST",
      message: "Passkey sign-in failed.",
      status: 401,
      request: req,
    });
  }
}
