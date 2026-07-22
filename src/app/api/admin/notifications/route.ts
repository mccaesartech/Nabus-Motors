import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchAdminNotifications,
  type AdminNotification,
} from "@/lib/platform/notifications";
import { getAdminSiteSettings, toOperationalSettings } from "@/lib/platform/site-settings";
import {
  adminNotificationRecipientScope,
  dismissAdminNotificationKeys,
  dismissAllEphemeralAdminNotifications,
  isEphemeralAdminNotificationId,
} from "@/lib/platform/notification-read-state";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
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
  const operational = toOperationalSettings(await getAdminSiteSettings());

  const { count: availableVehicles } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  const stockOptions = {
    lowStockThreshold: operational.lowStockThreshold,
    notifyLowStockEnabled: operational.notifyLowStockEnabled,
  };

  const { notifications, fromTable } = await fetchAdminNotifications(
    supabase,
    availableVehicles ?? 0,
    limit,
    auth.auth,
    stockOptions
  );

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return NextResponse.json({
    ok: true,
    configured: true,
    fromTable,
    unreadCount,
    notifications,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
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
  const scope = adminNotificationRecipientScope(auth.auth);

  if (all) {
    let query = supabase
      .from("admin_notifications")
      .update({ read_at: now })
      .is("read_at", null);
    query = query.or(
      auth.auth.type === "owner"
        ? "and(recipient_user_id.is.null,recipient_is_owner.eq.false),recipient_is_owner.eq.true"
        : `and(recipient_user_id.is.null,recipient_is_owner.eq.false),recipient_user_id.eq.${auth.auth.userId}`
    );
    const { error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    await dismissAllEphemeralAdminNotifications(supabase, scope);

    return NextResponse.json({ ok: true });
  }

  if (link || type) {
    let query = supabase
      .from("admin_notifications")
      .update({ read_at: now })
      .is("read_at", null);
    query = query.or(
      auth.auth.type === "owner"
        ? "and(recipient_user_id.is.null,recipient_is_owner.eq.false),recipient_is_owner.eq.true"
        : `and(recipient_user_id.is.null,recipient_is_owner.eq.false),recipient_user_id.eq.${auth.auth.userId}`
    );
    if (link) {
      query = query.eq("link", link);
    }
    if (type) {
      query = query.eq("type", type);
    }
    const { error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  if (isEphemeralAdminNotificationId(id)) {
    await dismissAdminNotificationKeys(supabase, scope, [id]);
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: now })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id || id === "low-stock") {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export type { AdminNotification };
