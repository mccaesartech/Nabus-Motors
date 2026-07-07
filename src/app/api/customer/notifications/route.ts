import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  fetchCustomerNotifications,
  mapCustomerNotification,
} from "@/lib/customer/notifications-server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      notifications: [],
      unreadCount: 0,
    });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const notifications = await fetchCustomerNotifications(supabase, user.id, limit);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return NextResponse.json({
    ok: true,
    configured: true,
    notifications,
    unreadCount,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { id, all, link, type } = body as {
    id?: string;
    all?: boolean;
    link?: string;
    type?: string;
  };
  const now = new Date().toISOString();

  if (all) {
    const { error } = await supabase
      .from("customer_notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (link || type) {
    let query = supabase
      .from("customer_notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (link) query = query.eq("link", link);
    if (type) query = query.eq("type", type);

    const { error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customer_notifications")
    .update({ read_at: now })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    notification: data ? mapCustomerNotification(data) : null,
  });
}
