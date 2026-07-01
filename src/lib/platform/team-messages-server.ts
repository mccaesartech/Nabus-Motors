import type { PlatformAuthContext } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  actorIsOwner,
  actorRole,
  actorUserId,
  canCreateTeamGroups,
  formatParticipant,
  type TeamChannelSummary,
  type TeamChannelType,
  type TeamConversationSummary,
  type TeamGroupMember,
  type TeamRecipient,
} from "@/lib/platform/team-messages";
import { normalizeRole } from "@/lib/platform/permissions";

export const OWNER_FALLBACK = {
  name: "Owner",
  email: process.env.OWNER_EMAIL ?? "owner@truegoshenauto.com",
  role: "owner" as const,
};

export type MemberRow = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  is_owner: boolean;
  last_read_at: string | null;
};

export type ConversationRow = {
  id: string;
  updated_at: string;
  channel_type: TeamChannelType;
  name: string | null;
  created_by_user_id: string | null;
  created_by_is_owner: boolean;
};

type SupabaseAdmin = NonNullable<ReturnType<typeof createAdminSupabase>>;

export async function loadUserMap(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from("platform_users")
    .select("id, name, email, role, status")
    .eq("status", "active");

  const map = new Map<
    string,
    { name: string; email: string; role: ReturnType<typeof normalizeRole> }
  >();
  for (const user of data ?? []) {
    map.set(user.id, {
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
    });
  }
  return map;
}

export function memberMatchesActor(member: MemberRow, auth: PlatformAuthContext) {
  if (actorIsOwner(auth)) return member.is_owner;
  return !member.is_owner && member.user_id === actorUserId(auth);
}

export async function findMemberId(
  supabase: SupabaseAdmin,
  conversationId: string,
  auth: PlatformAuthContext
) {
  const { data: members } = await supabase
    .from("platform_conversation_members")
    .select("id, conversation_id, user_id, is_owner, last_read_at")
    .eq("conversation_id", conversationId);

  return (members ?? []).find((m) => memberMatchesActor(m as MemberRow, auth)) ?? null;
}

export async function assertConversationAccess(
  supabase: SupabaseAdmin,
  conversationId: string,
  auth: PlatformAuthContext
) {
  const member = await findMemberId(supabase, conversationId, auth);
  if (!member) return null;
  return member as MemberRow;
}

export async function getOrCreateAllStaffConversation(supabase: SupabaseAdmin) {
  const { data: existing } = await supabase
    .from("platform_conversations")
    .select("id, updated_at, channel_type, name, created_by_user_id, created_by_is_owner")
    .eq("channel_type", "all_staff")
    .maybeSingle();

  if (existing) return existing as ConversationRow;

  const { data: created, error } = await supabase
    .from("platform_conversations")
    .insert({ channel_type: "all_staff", name: "All Staff" })
    .select("id, updated_at, channel_type, name, created_by_user_id, created_by_is_owner")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Could not create all-staff channel");
  }

  return created as ConversationRow;
}

export async function syncAllStaffMembers(supabase: SupabaseAdmin, conversationId: string) {
  const { data: users } = await supabase
    .from("platform_users")
    .select("id")
    .eq("status", "active");

  const { data: existingMembers } = await supabase
    .from("platform_conversation_members")
    .select("id, user_id, is_owner")
    .eq("conversation_id", conversationId);

  const existingUserIds = new Set(
    (existingMembers ?? []).filter((m) => m.user_id).map((m) => m.user_id as string)
  );
  const hasOwner = (existingMembers ?? []).some((m) => m.is_owner);

  const toInsert: Array<{ conversation_id: string; user_id?: string; is_owner: boolean }> = [];

  if (!hasOwner) {
    toInsert.push({ conversation_id: conversationId, is_owner: true });
  }

  for (const user of users ?? []) {
    if (!existingUserIds.has(user.id)) {
      toInsert.push({ conversation_id: conversationId, user_id: user.id, is_owner: false });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("platform_conversation_members").insert(toInsert);
  }
}

export async function ensureActorInAllStaff(
  supabase: SupabaseAdmin,
  conversationId: string,
  auth: PlatformAuthContext
) {
  const member = await findMemberId(supabase, conversationId, auth);
  if (member) return member as MemberRow;

  if (actorIsOwner(auth)) {
    const { data } = await supabase
      .from("platform_conversation_members")
      .insert({ conversation_id: conversationId, is_owner: true })
      .select("id, conversation_id, user_id, is_owner, last_read_at")
      .single();
    return data as MemberRow;
  }

  const userId = actorUserId(auth);
  if (!userId) return null;

  const { data } = await supabase
    .from("platform_conversation_members")
    .insert({ conversation_id: conversationId, user_id: userId, is_owner: false })
    .select("id, conversation_id, user_id, is_owner, last_read_at")
    .single();

  return data as MemberRow;
}

function groupCanManage(
  auth: PlatformAuthContext,
  conversation: ConversationRow
): boolean {
  if (canCreateTeamGroups(actorRole(auth))) return true;
  if (conversation.created_by_is_owner && actorIsOwner(auth)) return true;
  if (
    conversation.created_by_user_id &&
    conversation.created_by_user_id === actorUserId(auth)
  ) {
    return true;
  }
  return false;
}

export async function loadConversationMeta(
  supabase: SupabaseAdmin,
  conversationIds: string[]
): Promise<Map<string, ConversationRow>> {
  if (conversationIds.length === 0) return new Map();

  const { data } = await supabase
    .from("platform_conversations")
    .select(
      "id, updated_at, channel_type, name, created_by_user_id, created_by_is_owner"
    )
    .in("id", conversationIds);

  return new Map((data ?? []).map((c) => [c.id, c as ConversationRow]));
}

async function buildUnreadAndLastMessage(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext,
  conversationIds: string[],
  lastReadByConversation: Map<string, string | null>
) {
  const { data: messages } = await supabase
    .from("platform_messages")
    .select("id, conversation_id, body, created_at, sender_name, sender_is_owner, sender_user_id")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  const lastMessageByConversation = new Map<
    string,
    {
      body: string;
      created_at: string;
      sender_name: string;
    }
  >();
  const unreadByConversation = new Map<string, number>();

  for (const msg of messages ?? []) {
    if (!lastMessageByConversation.has(msg.conversation_id)) {
      lastMessageByConversation.set(msg.conversation_id, {
        body: msg.body,
        created_at: msg.created_at,
        sender_name: msg.sender_name,
      });
    }

    const lastRead = lastReadByConversation.get(msg.conversation_id);
    const isMine = actorIsOwner(auth)
      ? msg.sender_is_owner
      : !msg.sender_is_owner && msg.sender_user_id === actorUserId(auth);
    if (isMine) continue;
    if (lastRead && msg.created_at <= lastRead) continue;
    unreadByConversation.set(
      msg.conversation_id,
      (unreadByConversation.get(msg.conversation_id) ?? 0) + 1
    );
  }

  return { lastMessageByConversation, unreadByConversation };
}

export async function buildChannelSummaries(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext,
  channelTypes: Array<"all_staff" | "group">
): Promise<{ allStaff: TeamChannelSummary | null; groups: TeamChannelSummary[] }> {
  const allStaffConversation = await getOrCreateAllStaffConversation(supabase);
  await syncAllStaffMembers(supabase, allStaffConversation.id);
  await ensureActorInAllStaff(supabase, allStaffConversation.id, auth);

  const filter = actorIsOwner(auth)
    ? { column: "is_owner" as const, value: true }
    : { column: "user_id" as const, value: actorUserId(auth)! };

  const { data: myMemberships } = await supabase
    .from("platform_conversation_members")
    .select("id, conversation_id, last_read_at")
    .eq(filter.column, filter.value);

  if (!myMemberships?.length) {
    return { allStaff: null, groups: [] };
  }

  const conversationIds = myMemberships.map((m) => m.conversation_id);
  const lastReadByConversation = new Map(
    myMemberships.map((m) => [m.conversation_id, m.last_read_at])
  );

  const metaById = await loadConversationMeta(supabase, conversationIds);
  const channelConversationIds = conversationIds.filter((id) => {
    const meta = metaById.get(id);
    return meta && channelTypes.includes(meta.channel_type as "all_staff" | "group");
  });

  if (channelConversationIds.length === 0) {
    return { allStaff: null, groups: [] };
  }

  const [{ data: allMembers }, { lastMessageByConversation, unreadByConversation }] =
    await Promise.all([
      supabase
        .from("platform_conversation_members")
        .select("conversation_id, user_id, is_owner")
        .in("conversation_id", channelConversationIds),
      buildUnreadAndLastMessage(supabase, auth, channelConversationIds, lastReadByConversation),
    ]);

  const memberCountByConversation = new Map<string, number>();
  for (const row of allMembers ?? []) {
    memberCountByConversation.set(
      row.conversation_id,
      (memberCountByConversation.get(row.conversation_id) ?? 0) + 1
    );
  }

  let allStaff: TeamChannelSummary | null = null;
  const groups: TeamChannelSummary[] = [];

  for (const conversationId of channelConversationIds) {
    const meta = metaById.get(conversationId);
    if (!meta) continue;

    const summary: TeamChannelSummary = {
      id: conversationId,
      channelType: meta.channel_type as "all_staff" | "group",
      name: meta.name ?? (meta.channel_type === "all_staff" ? "All Staff" : "Group"),
      updated_at: meta.updated_at,
      memberCount: memberCountByConversation.get(conversationId) ?? 0,
      lastMessage: lastMessageByConversation.get(conversationId) ?? null,
      unreadCount: unreadByConversation.get(conversationId) ?? 0,
      canManage: meta.channel_type === "group" ? groupCanManage(auth, meta) : false,
    };

    if (meta.channel_type === "all_staff") {
      allStaff = summary;
    } else if (meta.channel_type === "group") {
      groups.push(summary);
    }
  }

  groups.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return { allStaff, groups };
}

export async function findExistingConversation(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext,
  recipientUserId: string | null,
  recipientIsOwner: boolean
) {
  const { data: myMemberships } = await supabase
    .from("platform_conversation_members")
    .select("conversation_id, user_id, is_owner")
    .eq(actorIsOwner(auth) ? "is_owner" : "user_id", actorIsOwner(auth) ? true : actorUserId(auth)!);

  const myConversationIds = (myMemberships ?? []).map((m) => m.conversation_id);
  if (myConversationIds.length === 0) return null;

  const metaById = await loadConversationMeta(supabase, myConversationIds);
  const directIds = myConversationIds.filter((id) => {
    const meta = metaById.get(id);
    return !meta || meta.channel_type === "direct";
  });

  if (directIds.length === 0) return null;

  const { data: allMembers } = await supabase
    .from("platform_conversation_members")
    .select("conversation_id, user_id, is_owner")
    .in("conversation_id", directIds);

  const byConversation = new Map<string, Array<{ user_id: string | null; is_owner: boolean }>>();
  for (const row of allMembers ?? []) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push({ user_id: row.user_id, is_owner: row.is_owner });
    byConversation.set(row.conversation_id, list);
  }

  for (const [conversationId, members] of byConversation) {
    if (members.length !== 2) continue;

    const hasRecipient = members.some((m) => {
      if (recipientIsOwner) return m.is_owner;
      return !m.is_owner && m.user_id === recipientUserId;
    });
    const hasActor = members.some((m) => memberMatchesActor(m as MemberRow, auth));

    if (hasRecipient && hasActor) return conversationId;
  }

  return null;
}

export async function createDirectConversation(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext,
  recipientUserId: string | null,
  recipientIsOwner: boolean
) {
  const { data: conversation, error } = await supabase
    .from("platform_conversations")
    .insert({ channel_type: "direct" })
    .select("id")
    .single();

  if (error || !conversation) {
    throw new Error(error?.message ?? "Could not create conversation");
  }

  const members: Array<{ conversation_id: string; user_id?: string; is_owner: boolean }> = [];

  if (actorIsOwner(auth)) {
    members.push({ conversation_id: conversation.id, is_owner: true });
    if (!recipientIsOwner && recipientUserId) {
      members.push({ conversation_id: conversation.id, user_id: recipientUserId, is_owner: false });
    }
  } else {
    members.push({ conversation_id: conversation.id, user_id: actorUserId(auth)!, is_owner: false });
    if (recipientIsOwner) {
      members.push({ conversation_id: conversation.id, is_owner: true });
    } else if (recipientUserId) {
      members.push({ conversation_id: conversation.id, user_id: recipientUserId, is_owner: false });
    }
  }

  const { error: memberError } = await supabase.from("platform_conversation_members").insert(members);
  if (memberError) {
    await supabase.from("platform_conversations").delete().eq("id", conversation.id);
    throw new Error(memberError.message);
  }

  return conversation.id as string;
}

export async function buildRecipients(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext
): Promise<TeamRecipient[]> {
  const { data: users } = await supabase
    .from("platform_users")
    .select("id, name, email, role, status")
    .eq("status", "active")
    .order("name");

  const recipients: TeamRecipient[] = [];

  if (!actorIsOwner(auth)) {
    recipients.push({
      userId: null,
      isOwner: true,
      name: OWNER_FALLBACK.name,
      email: OWNER_FALLBACK.email,
      role: "owner",
      status: "active",
    });
  }

  for (const user of users ?? []) {
    if (!actorIsOwner(auth) && user.id === actorUserId(auth)) continue;
    recipients.push({
      userId: user.id,
      isOwner: false,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      status: user.status,
    });
  }

  return recipients;
}

export async function buildConversationSummaries(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext,
  userMap: Awaited<ReturnType<typeof loadUserMap>>
): Promise<TeamConversationSummary[]> {
  const filter = actorIsOwner(auth)
    ? { column: "is_owner" as const, value: true }
    : { column: "user_id" as const, value: actorUserId(auth)! };

  const { data: myMemberships } = await supabase
    .from("platform_conversation_members")
    .select("id, conversation_id, last_read_at")
    .eq(filter.column, filter.value);

  if (!myMemberships?.length) return [];

  const conversationIds = myMemberships.map((m) => m.conversation_id);
  const lastReadByConversation = new Map(
    myMemberships.map((m) => [m.conversation_id, m.last_read_at])
  );

  const metaById = await loadConversationMeta(supabase, conversationIds);
  const directIds = conversationIds.filter((id) => {
    const meta = metaById.get(id);
    return !meta || meta.channel_type === "direct";
  });

  if (directIds.length === 0) return [];

  const [{ data: allMembers }, { lastMessageByConversation, unreadByConversation }] =
    await Promise.all([
      supabase
        .from("platform_conversation_members")
        .select("conversation_id, user_id, is_owner")
        .in("conversation_id", directIds),
      buildUnreadAndLastMessage(supabase, auth, directIds, lastReadByConversation),
    ]);

  const membersByConversation = new Map<string, Array<{ user_id: string | null; is_owner: boolean }>>();
  for (const row of allMembers ?? []) {
    const list = membersByConversation.get(row.conversation_id) ?? [];
    list.push({ user_id: row.user_id, is_owner: row.is_owner });
    membersByConversation.set(row.conversation_id, list);
  }

  const summaries: TeamConversationSummary[] = [];

  for (const conversationId of directIds) {
    const members = membersByConversation.get(conversationId) ?? [];
    const otherMember = members.find((m) => !memberMatchesActor(m as MemberRow, auth));
    if (!otherMember) continue;

    const userInfo = otherMember.user_id ? userMap.get(otherMember.user_id) : null;
    const other = formatParticipant(
      otherMember,
      otherMember.is_owner ? OWNER_FALLBACK : userInfo ?? undefined
    );

    const last = lastMessageByConversation.get(conversationId);
    const meta = metaById.get(conversationId);
    summaries.push({
      id: conversationId,
      updated_at: meta?.updated_at ?? new Date().toISOString(),
      other,
      lastMessage: last ?? null,
      unreadCount: unreadByConversation.get(conversationId) ?? 0,
    });
  }

  summaries.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return summaries;
}

export async function loadGroupMembers(
  supabase: SupabaseAdmin,
  conversationId: string,
  userMap: Awaited<ReturnType<typeof loadUserMap>>
): Promise<TeamGroupMember[]> {
  const { data: members } = await supabase
    .from("platform_conversation_members")
    .select("user_id, is_owner")
    .eq("conversation_id", conversationId);

  return (members ?? []).map((m) => {
    if (m.is_owner) {
      return {
        userId: null,
        isOwner: true,
        name: OWNER_FALLBACK.name,
        email: OWNER_FALLBACK.email,
        role: "owner" as const,
      };
    }
    const user = m.user_id ? userMap.get(m.user_id) : null;
    return {
      userId: m.user_id,
      isOwner: false,
      name: user?.name ?? "Team member",
      email: user?.email ?? "",
      role: user?.role ?? "staff",
    };
  });
}

export async function createGroup(
  supabase: SupabaseAdmin,
  auth: PlatformAuthContext,
  name: string,
  memberUserIds: string[]
) {
  const uniqueIds = [...new Set(memberUserIds)].filter((id) => id !== actorUserId(auth));

  const { data: conversation, error } = await supabase
    .from("platform_conversations")
    .insert({
      channel_type: "group",
      name: name.trim(),
      created_by_user_id: actorIsOwner(auth) ? null : actorUserId(auth),
      created_by_is_owner: actorIsOwner(auth),
    })
    .select("id")
    .single();

  if (error || !conversation) {
    throw new Error(error?.message ?? "Could not create group");
  }

  const members: Array<{ conversation_id: string; user_id?: string; is_owner: boolean }> = [];

  if (actorIsOwner(auth)) {
    members.push({ conversation_id: conversation.id, is_owner: true });
  } else {
    members.push({
      conversation_id: conversation.id,
      user_id: actorUserId(auth)!,
      is_owner: false,
    });
  }

  for (const userId of uniqueIds) {
    members.push({ conversation_id: conversation.id, user_id: userId, is_owner: false });
  }

  const { error: memberError } = await supabase.from("platform_conversation_members").insert(members);
  if (memberError) {
    await supabase.from("platform_conversations").delete().eq("id", conversation.id);
    throw new Error(memberError.message);
  }

  return conversation.id as string;
}

export async function updateGroupMembers(
  supabase: SupabaseAdmin,
  conversationId: string,
  memberUserIds: string[]
) {
  const { data: existing } = await supabase
    .from("platform_conversation_members")
    .select("id, user_id, is_owner")
    .eq("conversation_id", conversationId);

  const ownerMember = (existing ?? []).find((m) => m.is_owner);
  const existingUserIds = new Set(
    (existing ?? []).filter((m) => m.user_id).map((m) => m.user_id as string)
  );
  const targetUserIds = new Set(memberUserIds);

  const toRemove = (existing ?? []).filter(
    (m) => m.user_id && !targetUserIds.has(m.user_id)
  );
  const toAdd = memberUserIds.filter((id) => !existingUserIds.has(id));

  if (toRemove.length > 0) {
    await supabase
      .from("platform_conversation_members")
      .delete()
      .in(
        "id",
        toRemove.map((m) => m.id)
      );
  }

  if (toAdd.length > 0) {
    await supabase.from("platform_conversation_members").insert(
      toAdd.map((userId) => ({
        conversation_id: conversationId,
        user_id: userId,
        is_owner: false,
      }))
    );
  }

  const finalCount =
    (ownerMember ? 1 : 0) +
    [...existingUserIds].filter((id) => targetUserIds.has(id)).length +
    toAdd.length;

  if (finalCount < 2) {
    throw new Error("A group must have at least two members");
  }
}

export type ConversationAuditParticipant = {
  name: string;
  email: string;
  role: string;
};

export type ConversationAuditContext = {
  channel_type: TeamChannelType;
  conversation_label: string;
  participants: ConversationAuditParticipant[];
};

/** Conversation context for owner activity / audit logs. */
export async function buildConversationAuditContext(
  supabase: SupabaseAdmin,
  conversationId: string
): Promise<ConversationAuditContext> {
  const metaById = await loadConversationMeta(supabase, [conversationId]);
  const meta = metaById.get(conversationId);
  const channelType = (meta?.channel_type ?? "direct") as TeamChannelType;

  const { data: members } = await supabase
    .from("platform_conversation_members")
    .select("user_id, is_owner")
    .eq("conversation_id", conversationId);

  const userMap = await loadUserMap(supabase);

  const participants: ConversationAuditParticipant[] = (members ?? []).map((member) => {
    if (member.is_owner) {
      return {
        name: OWNER_FALLBACK.name,
        email: OWNER_FALLBACK.email,
        role: "owner",
      };
    }
    const user = member.user_id ? userMap.get(member.user_id) : null;
    return {
      name: user?.name ?? "Team member",
      email: user?.email ?? "",
      role: user?.role ?? "staff",
    };
  });

  let conversation_label: string;
  if (channelType === "all_staff") {
    conversation_label = "All Staff";
  } else if (channelType === "group") {
    conversation_label = `Group: ${meta?.name ?? "Unnamed"}`;
  } else {
    const names = participants.map((p) => p.name);
    conversation_label =
      names.length === 2
        ? `Direct message: ${names.join(" ↔ ")}`
        : `Direct message (${names.join(", ")})`;
  }

  return {
    channel_type: channelType,
    conversation_label,
    participants,
  };
}
