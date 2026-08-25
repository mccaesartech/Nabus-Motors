import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { enqueueAuditLog } from "@/lib/audit/write";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

type AuditEvent = "google_sign_in" | "google_sign_in_failed" | "password_changed";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const event = typeof body.event === "string" ? (body.event as AuditEvent) : "";
  const error =
    typeof body.error === "string" ? body.error.trim().slice(0, 500) : undefined;

  if (event === "google_sign_in") {
    const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    enqueueAuditLog({
      action: "google_sign_in",
      success: true,
      actorUserId: user.id,
      actorName: user.email ?? null,
      actorRole: "customer",
      targetType: "customer",
      targetId: user.id,
      request: req,
    });
    return NextResponse.json({ ok: true });
  }

  if (event === "google_sign_in_failed") {
    const rate = consumeRateLimit(
      "customer-auth-audit-fail",
      requestIp(req.headers),
      { limit: 30, windowMs: 15 * 60_000 }
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, message: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    enqueueAuditLog({
      action: "google_sign_in_failed",
      success: false,
      actorRole: "customer",
      targetType: "customer",
      errorMessage: error || "oauth_error",
      request: req,
    });
    return NextResponse.json({ ok: true });
  }

  if (event === "password_changed") {
    const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    enqueueAuditLog({
      action: "password_changed",
      success: true,
      actorUserId: user.id,
      actorName: user.email ?? null,
      actorRole: "customer",
      targetType: "customer",
      targetId: user.id,
      request: req,
    });

    void import("@/lib/customer/security-notify")
      .then(({ notifyPasswordChanged }) =>
        notifyPasswordChanged({ userId: user.id, email: user.email })
      )
      .catch(() => {});

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Unknown event." }, { status: 400 });
}
