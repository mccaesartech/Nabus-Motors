import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission, type PlatformAuthContext } from "@/lib/admin/auth";
import {
  countFailedEmails,
  fetchReceivedCommunications,
  fetchSentEmails,
} from "@/lib/platform/emails";
import {
  clearNotificationsForDeletedSource,
  hideEphemeralDeliveryNotification,
  softDeleteAdminNotificationsBySource,
} from "@/lib/platform/admin-notification-trash";
import {
  buildEntityLabel,
  normalizeBatchIds,
  recordTrashEntry,
  softDeleteEntity,
} from "@/lib/platform/trash";
import { createAdminSupabase } from "@/lib/supabase/admin";

type ParsedEmailItemId =
  | { kind: "sent"; id: string }
  | { kind: "contact"; id: string }
  | { kind: "vehicle"; id: string }
  | { kind: "message"; id: string };

function parseEmailItemId(raw: string): ParsedEmailItemId | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const [prefix, id] = trimmed.split(":", 2);
    if (!id?.trim()) return null;
    if (prefix === "contact" || prefix === "vehicle" || prefix === "message") {
      return { kind: prefix, id: id.trim() };
    }
  }

  return { kind: "sent", id: trimmed };
}

async function deleteSentEmailLog(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("notification_log")
    .select("*")
    .eq("id", id)
    .eq("channel", "email")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Record not found." };

  const snapshot = { ...data } as Record<string, unknown>;
  const entityLabel = buildEntityLabel("sent_email", snapshot);
  const trash = await recordTrashEntry(
    supabase,
    auth,
    "sent_email",
    id,
    entityLabel,
    snapshot
  );
  if (!trash.ok) return trash;

  const { error: deleteError } = await supabase
    .from("notification_log")
    .delete()
    .eq("id", id)
    .eq("channel", "email");

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  // Hide synthetic delivery alert + any legacy persisted rows linked to this log.
  await hideEphemeralDeliveryNotification(supabase, auth, id, {
    id: `notification-log-${id}`,
    title: entityLabel,
    ephemeral: true,
    ...snapshot,
  });
  await softDeleteAdminNotificationsBySource(supabase, auth, "notification_log", id);

  return { ok: true };
}

async function deleteCustomerMessage(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  messageId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("customer_conversation_messages")
    .select("id, conversation_id, sender_type")
    .eq("id", messageId)
    .eq("sender_type", "customer")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Record not found." };

  const { error: deleteError } = await supabase
    .from("customer_conversation_messages")
    .delete()
    .eq("id", messageId);

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  await clearNotificationsForDeletedSource(
    supabase,
    auth,
    "customer_conversation_messages",
    messageId
  );

  return { ok: true };
}

async function deleteEmailItems(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  rawIds: string[]
) {
  const ids = normalizeBatchIds(rawIds);
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];

  for (const rawId of ids) {
    const parsed = parseEmailItemId(rawId);
    if (!parsed) {
      failed.push({ id: rawId, message: "Invalid id." });
      continue;
    }

    if (parsed.kind === "sent") {
      const result = await deleteSentEmailLog(supabase, auth, parsed.id);
      if (result.ok) deletedIds.push(rawId);
      else failed.push({ id: rawId, message: result.message });
      continue;
    }

    if (parsed.kind === "contact") {
      const result = await softDeleteEntity(supabase, auth, "lead_contact", parsed.id);
      if (result.ok) {
        deletedIds.push(rawId);
        await clearNotificationsForDeletedSource(
          supabase,
          auth,
          "contact_inquiries",
          parsed.id
        );
      } else {
        failed.push({ id: rawId, message: result.message });
      }
      continue;
    }

    if (parsed.kind === "vehicle") {
      const result = await softDeleteEntity(supabase, auth, "lead_vehicle", parsed.id);
      if (result.ok) {
        deletedIds.push(rawId);
        await clearNotificationsForDeletedSource(
          supabase,
          auth,
          "vehicle_inquiries",
          parsed.id
        );
      } else {
        failed.push({ id: rawId, message: result.message });
      }
      continue;
    }

    const result = await deleteCustomerMessage(supabase, auth, parsed.id);
    if (result.ok) deletedIds.push(rawId);
    else failed.push({ id: rawId, message: result.message });
  }

  return { deletedIds, failed };
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("emails");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      items: [],
      total: 0,
      failedCount: 0,
      inboundConfigured: false,
    });
  }

  const params = req.nextUrl.searchParams;
  const summary = params.get("summary") === "1";

  if (summary) {
    const failedCount = await countFailedEmails(supabase);
    return NextResponse.json({ ok: true, configured: true, failedCount });
  }

  const tab = params.get("tab") === "received" ? "received" : "sent";
  const page = Number(params.get("page") ?? 1);
  const limit = Number(params.get("limit") ?? 50);
  const id = params.get("id") ?? undefined;
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;

  if (tab === "received") {
    const type = params.get("type") ?? "all";
    const result = await fetchReceivedCommunications(supabase, {
      page,
      limit,
      id,
      from,
      to,
      type,
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      tab,
      inboundConfigured: false,
      inboundNote:
        "Inbound email parsing is not configured. Showing contact form submissions and customer messages.",
      items: result.items,
      total: result.total,
      page,
      limit,
      failedCount: await countFailedEmails(supabase),
    });
  }

  const status = params.get("status") ?? "all";
  const template = params.get("template") ?? "all";
  const result = await fetchSentEmails(supabase, {
    page,
    limit,
    id,
    from,
    to,
    status,
    template,
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    tab,
    items: result.items,
    total: result.total,
    templates: result.templates,
    page,
    limit,
    failedCount: await countFailedEmails(supabase),
    inboundConfigured: false,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("emails");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const queryId = req.nextUrl.searchParams.get("id");
  let ids: string[] = [];
  if (queryId?.trim()) {
    ids = [queryId.trim()];
  } else {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown; id?: unknown };
    if (typeof body.id === "string" && body.id.trim()) {
      ids = [body.id.trim()];
    } else {
      ids = normalizeBatchIds(body.ids);
    }
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const batch = await deleteEmailItems(supabase, auth.auth, ids);

  if (batch.deletedIds.length === 0) {
    const first = batch.failed[0];
    return NextResponse.json(
      {
        ok: false,
        message: first?.message ?? "Could not delete email record(s).",
        failed: batch.failed,
        deletedIds: [],
      },
      { status: first?.message === "Record not found." ? 404 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    deletedIds: batch.deletedIds,
    failed: batch.failed,
    message:
      batch.deletedIds.length === 1
        ? "Email record moved to trash."
        : `${batch.deletedIds.length} email records moved to trash.${
            batch.failed.length > 0 ? ` ${batch.failed.length} could not be deleted.` : ""
          }`,
  });
}
