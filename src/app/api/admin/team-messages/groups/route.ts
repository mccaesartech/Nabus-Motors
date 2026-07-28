import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/errors/api";
import { requirePermission } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  actorIsOwner,
  actorRole,
  actorUserId,
  canCreateTeamGroups,
} from "@/lib/platform/team-messages";
import {
  assertConversationAccess,
  createGroup,
  loadConversationMeta,
  loadGroupMembers,
  loadUserMap,
  updateGroupMembers,
  type ConversationRow,
} from "@/lib/platform/team-messages-server";

function canManageGroup(
  auth: Parameters<typeof assertConversationAccess>[2],
  conversation: ConversationRow
): boolean {
  if (canCreateTeamGroups(actorRole(auth))) return true;
  if (conversation.created_by_is_owner && actorIsOwner(auth)) return true;
  if (conversation.created_by_user_id && conversation.created_by_user_id === actorUserId(auth)) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const authResult = await requirePermission("team_messages");
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const groupId = req.nextUrl.searchParams.get("groupId");
  if (!groupId) {
    return NextResponse.json({ ok: false, message: "groupId required" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const member = await assertConversationAccess(supabase, groupId, authResult.auth);
  if (!member) {
    return NextResponse.json({ ok: false, message: "Group not found" }, { status: 404 });
  }

  const metaById = await loadConversationMeta(supabase, [groupId]);
  const meta = metaById.get(groupId);
  if (!meta || meta.channel_type !== "group") {
    return NextResponse.json({ ok: false, message: "Group not found" }, { status: 404 });
  }

  const userMap = await loadUserMap(supabase);
  const members = await loadGroupMembers(supabase, groupId, userMap);

  return NextResponse.json({
    ok: true,
    group: {
      id: meta.id,
      name: meta.name ?? "Group",
      members,
      canManage: canManageGroup(authResult.auth, meta),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requirePermission("team_messages");
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  if (!canCreateTeamGroups(actorRole(authResult.auth))) {
    return NextResponse.json(
      { ok: false, message: "Only owners and managers can create groups" },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const memberUserIds = Array.isArray(body.memberUserIds)
    ? body.memberUserIds.map((id: unknown) => String(id))
    : [];

  if (!name) {
    return NextResponse.json({ ok: false, message: "Group name required" }, { status: 400 });
  }

  if (memberUserIds.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Select at least one team member" },
      { status: 400 }
    );
  }

  const { data: activeUsers } = await supabase
    .from("platform_users")
    .select("id")
    .eq("status", "active")
    .in("id", memberUserIds);

  if ((activeUsers ?? []).length !== memberUserIds.length) {
    return NextResponse.json({ ok: false, message: "Invalid team members selected" }, { status: 400 });
  }

  try {
    const groupId = await createGroup(supabase, authResult.auth, name, memberUserIds);
    await logPlatformActivity(authResult.auth, "team_group_created", groupId, { name });

    return NextResponse.json({ ok: true, groupId });
  } catch (err) {
    return apiFailure(err, {
      module: "api.admin.team-messages.groups.POST",
      message: "Could not create group",
      request: req,
    });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requirePermission("team_messages");
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const groupId = body.groupId ? String(body.groupId) : null;
  if (!groupId) {
    return NextResponse.json({ ok: false, message: "groupId required" }, { status: 400 });
  }

  const member = await assertConversationAccess(supabase, groupId, authResult.auth);
  if (!member) {
    return NextResponse.json({ ok: false, message: "Group not found" }, { status: 404 });
  }

  const metaById = await loadConversationMeta(supabase, [groupId]);
  const meta = metaById.get(groupId);
  if (!meta || meta.channel_type !== "group") {
    return NextResponse.json({ ok: false, message: "Group not found" }, { status: 404 });
  }

  if (!canManageGroup(authResult.auth, meta)) {
    return NextResponse.json(
      { ok: false, message: "You cannot manage this group" },
      { status: 403 }
    );
  }

  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const memberUserIds = Array.isArray(body.memberUserIds)
    ? body.memberUserIds.map((id: unknown) => String(id))
    : null;

  if (name !== undefined) {
    if (!name) {
      return NextResponse.json({ ok: false, message: "Group name required" }, { status: 400 });
    }
    await supabase.from("platform_conversations").update({ name }).eq("id", groupId);
  }

  if (memberUserIds) {
    const { data: activeUsers } = await supabase
      .from("platform_users")
      .select("id")
      .eq("status", "active")
      .in("id", memberUserIds);

    if ((activeUsers ?? []).length !== memberUserIds.length) {
      return NextResponse.json({ ok: false, message: "Invalid team members selected" }, { status: 400 });
    }

    try {
      await updateGroupMembers(supabase, groupId, memberUserIds);
    } catch (err) {
      return apiFailure(err, {
        module: "api.admin.team-messages.groups.PATCH",
        message: "Could not update members",
        status: 400,
        request: req,
      });
    }
  }

  await logPlatformActivity(authResult.auth, "team_group_updated", groupId, {
    name,
    member_count: memberUserIds?.length,
  });

  return NextResponse.json({ ok: true });
}
