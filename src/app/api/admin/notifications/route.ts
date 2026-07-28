import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
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
import { softDeleteAdminNotifications } from "@/lib/platform/admin-notification-trash";
import { normalizeBatchIds } from "@/lib/platform/trash";

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

  const [operational, availableRes] = await Promise.all([
    getAdminSiteSettings().then((s) => toOperationalSettings(s)),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("status", "available"),
  ]);

  const stockOptions = {
    lowStockThreshold: operational.lowStockThreshold,
    notifyLowStockEnabled: operational.notifyLowStockEnabled,
  };

  const { notifications, fromTable } = await fetchAdminNotifications(
    supabase,
    availableRes.count ?? 0,
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
      return dbFailure(error, {
        module: "api.admin.notifications.PATCH",
        message: "We could not load your notifications. Try again.",
        request: req,
      });
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
      return dbFailure(error, {
        module: "api.admin.notifications.PATCH",
        message: "We could not load your notifications. Try again.",
        request: req,
      });
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
    return dbFailure(error, {
      module: "api.admin.notifications.PATCH",
      message: "We could not load your notifications. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const queryId = req.nextUrl.searchParams.get("id");
  let ids: string[] = [];
  let snapshotsById: Record<string, Record<string, unknown>> | undefined;

  if (queryId?.trim()) {
    ids = [queryId.trim()];
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      ids?: unknown;
      id?: unknown;
      snapshots?: unknown;
    };
    if (typeof body.id === "string" && body.id.trim()) {
      ids = [body.id.trim()];
    } else {
      ids = normalizeBatchIds(body.ids);
    }
    if (body.snapshots && typeof body.snapshots === "object" && !Array.isArray(body.snapshots)) {
      snapshotsById = body.snapshots as Record<string, Record<string, unknown>>;
    }
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const batch = await softDeleteAdminNotifications(
    supabase,
    auth.auth,
    ids,
    snapshotsById
  );

  if (batch.deletedIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: batch.failed[0]?.message ?? "Could not move notification(s) to trash.",
        failed: batch.failed,
        deletedIds: [],
      },
      { status: batch.failed[0]?.message?.includes("cannot be deleted") ? 400 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    deletedIds: batch.deletedIds,
    failed: batch.failed,
    message:
      batch.deletedIds.length === 1
        ? "Notification moved to trash."
        : `${batch.deletedIds.length} notifications moved to trash.`,
  });
}

export type { AdminNotification };
