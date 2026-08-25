import { NextRequest, NextResponse } from "next/server";
import { resolveExternalAuthSession } from "@/lib/customer/external-session";
import { upsertCustomerSession } from "@/lib/customer/sessions";
import { requestIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await resolveExternalAuthSession(req.headers);
  if (!session) {
    return NextResponse.json(
      { ok: false, user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Track device fingerprint on session resolve; alert only for new devices.
  try {
    const profilePhone =
      session.user.user_metadata &&
      typeof session.user.user_metadata === "object" &&
      session.user.user_metadata.profile &&
      typeof session.user.user_metadata.profile === "object"
        ? String(
            (session.user.user_metadata.profile as { phone?: string | null }).phone ??
              ""
          ).trim() || null
        : null;

    const touch = await upsertCustomerSession({
      userId: session.user.id,
      ip: requestIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
    // Evaluate every resolve so a failed first send can retry (idempotent).
    void import("@/lib/customer/security-notify")
      .then(({ maybeNotifyNewDeviceLogin }) =>
        maybeNotifyNewDeviceLogin({
          userId: session.user.id,
          email: session.user.email,
          phone: profilePhone,
          customerName: session.user.name,
          fingerprint: touch.fingerprint,
          isNewSession: touch.isNew,
          userAgent: req.headers.get("user-agent"),
          ip: requestIp(req.headers),
        })
      )
      .catch(() => {});
  } catch {
    // non-blocking
  }

  return NextResponse.json(
    { ok: true, ...session },
    { headers: { "Cache-Control": "no-store" } }
  );
}
