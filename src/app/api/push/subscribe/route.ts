import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { getPlatformAuth } from "@/lib/admin/auth";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PushSubscriptionRole } from "@/lib/push/subscription";

type SubscribeBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
  role?: PushSubscriptionRole;
  userAgent?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SubscribeBody;
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();
  const role = body.role;

  if (!endpoint || !p256dh || !authKey || (role !== "customer" && role !== "admin")) {
    return NextResponse.json(
      { ok: false, message: "Invalid push subscription payload." },
      { status: 400 }
    );
  }

  const customer = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  const platformAuth = customer ? null : await getPlatformAuth();

  if (role === "customer" && !customer) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (role === "admin") {
    if (!platformAuth) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    if (!platformAuth.userId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Admin push requires a platform user session (owner bootstrap is not supported).",
        },
        { status: 400 }
      );
    }
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: true,
        configured: false,
        message: "Push subscriptions require Supabase. Run migration 071_push_subscriptions.sql.",
      },
      { status: 202 }
    );
  }

  const { error } =
    role === "customer"
      ? await supabase.from("push_subscriptions").upsert(
          {
            customer_user_id: customer!.id,
            platform_user_id: null,
            endpoint,
            p256dh,
            auth: authKey,
            role: "customer",
            expiration_time: body.expirationTime ?? null,
            user_agent: body.userAgent?.slice(0, 512) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        )
      : await supabase.from("push_subscriptions").upsert(
          {
            customer_user_id: null,
            platform_user_id: platformAuth!.userId!,
            endpoint,
            p256dh,
            auth: authKey,
            role: "admin",
            expiration_time: body.expirationTime ?? null,
            user_agent: body.userAgent?.slice(0, 512) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        );

  if (error) {
    return dbFailure(error, {
      module: "api.push.subscribe.POST.store",
      message: "Push notifications could not be enabled. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true, configured: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ ok: false, message: "endpoint required" }, { status: 400 });
  }

  const customer = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  const platformAuth = customer ? null : await getPlatformAuth();
  if (!customer && !platformAuth) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  if (platformAuth && !platformAuth.userId) {
    return NextResponse.json(
      { ok: false, message: "Admin push requires a platform user session." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false }, { status: 202 });
  }

  const deleteQuery = supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = customer
    ? await deleteQuery.eq("customer_user_id", customer.id).eq("role", "customer")
    : await deleteQuery.eq("platform_user_id", platformAuth!.userId!).eq("role", "admin");
  if (error) {
    return dbFailure(error, {
      module: "api.push.subscribe.DELETE",
      message: "Push notifications could not be enabled. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}
