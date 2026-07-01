import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  ROLE_LABELS,
  normalizeRole,
  type PlatformRole,
} from "@/lib/platform/permissions";

export type TeamChannelType = "direct" | "all_staff" | "group";

export type TeamMessageParticipant = {
  userId: string | null;
  isOwner: boolean;
  name: string;
  email: string;
  role: PlatformRole | "owner";
};

export type TeamMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_is_owner: boolean;
  sender_name: string;
  sender_email: string;
  body: string;
  created_at: string;
  isMine: boolean;
};

export type TeamConversationSummary = {
  id: string;
  updated_at: string;
  other: TeamMessageParticipant;
  lastMessage: { body: string; created_at: string; sender_name: string } | null;
  unreadCount: number;
};

export type TeamChannelSummary = {
  id: string;
  channelType: "all_staff" | "group";
  name: string;
  updated_at: string;
  memberCount: number;
  lastMessage: { body: string; created_at: string; sender_name: string } | null;
  unreadCount: number;
  canManage: boolean;
};

export type TeamGroupMember = {
  userId: string | null;
  isOwner: boolean;
  name: string;
  email: string;
  role: PlatformRole | "owner";
};

export type TeamRecipient = {
  userId: string | null;
  isOwner: boolean;
  name: string;
  email: string;
  role: PlatformRole | "owner";
  status: string;
};

export function actorIsOwner(auth: PlatformAuthContext): boolean {
  return auth.type === "owner";
}

export function actorUserId(auth: PlatformAuthContext): string | null {
  return auth.type === "user" ? (auth.userId ?? null) : null;
}

export function messageIsFromActor(
  auth: PlatformAuthContext,
  msg: { sender_is_owner: boolean; sender_user_id: string | null }
): boolean {
  if (actorIsOwner(auth)) return msg.sender_is_owner;
  return !msg.sender_is_owner && msg.sender_user_id === actorUserId(auth);
}

export function formatParticipant(
  row: {
    user_id: string | null;
    is_owner: boolean;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  },
  fallback?: { name: string; email: string; role: PlatformRole | "owner" }
): TeamMessageParticipant {
  if (row.is_owner) {
    return {
      userId: null,
      isOwner: true,
      name: fallback?.name ?? "Owner",
      email: fallback?.email ?? "",
      role: "owner",
    };
  }
  const role = normalizeRole(row.role ?? fallback?.role ?? "staff");
  return {
    userId: row.user_id,
    isOwner: false,
    name: row.name ?? fallback?.name ?? "Team member",
    email: row.email ?? fallback?.email ?? "",
    role,
  };
}

export function participantLabel(participant: TeamMessageParticipant): string {
  if (participant.isOwner) return "Owner";
  return ROLE_LABELS[participant.role as PlatformRole] ?? participant.role;
}

export function canCreateTeamGroups(role: PlatformRole | "owner"): boolean {
  return role === "owner" || role === "super_admin" || role === "manager";
}

export function actorRole(auth: PlatformAuthContext): PlatformRole | "owner" {
  if (auth.type === "owner") return "owner";
  return normalizeRole(auth.role);
}
