import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  listCustomerSessions,
  revokeAllCustomerSessions,
  revokeCustomerSession,
  sessionFingerprint,
  upsertCustomerSession,
} from "@/lib/customer/sessions";
import { requestIp } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  }

  const currentFp = sessionFingerprint({
    userAgent: req.headers.get("user-agent"),
    ip: requestIp(req.headers),
  });

  // Touch current session; alert when fingerprint is new (idempotent retries OK).
  const sessionTouch = await upsertCustomerSession({
    userId: user.id,
    ip: requestIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });
  void import("@/lib/customer/security-notify")
    .then(({ maybeNotifyNewDeviceLogin }) =>
      maybeNotifyNewDeviceLogin({
        userId: user.id,
        email: user.email,
        fingerprint: sessionTouch.fingerprint,
        isNewSession: sessionTouch.isNew,
        userAgent: req.headers.get("user-agent"),
        ip: requestIp(req.headers),
      })
    )
    .catch(() => {});

  const sessions = await listCustomerSessions(user.id);
  return NextResponse.json({
    ok: true,
    sessions: sessions.map((s) => ({
      ...s,
      current: s.session_fingerprint === currentFp,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const all = Boolean(body.all);

  if (all) {
    const currentFp = sessionFingerprint({
      userAgent: req.headers.get("user-agent"),
      ip: requestIp(req.headers),
    });
    const count = await revokeAllCustomerSessions(user.id, currentFp);
    return NextResponse.json({ ok: true, revoked: count });
  }

  if (!sessionId) {
    return NextResponse.json({ ok: false, message: "Session id is required." }, { status: 400 });
  }

  const ok = await revokeCustomerSession(user.id, sessionId);
  return NextResponse.json(
    ok ? { ok: true } : { ok: false, message: "Could not revoke that session." },
    { status: ok ? 200 : 400 }
  );
}
