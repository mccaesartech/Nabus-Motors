"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  UserRound,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  fetchWithTimeout,
  isAdminAuthError,
  isTeamChatSetupError,
  parseAdminResponse,
} from "@/lib/admin/client";
import {
  participantLabel,
  type TeamChannelSummary,
  type TeamConversationSummary,
  type TeamGroupMember,
  type TeamMessage,
  type TeamRecipient,
} from "@/lib/platform/team-messages";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { useTeamChatRealtime } from "@/lib/platform/realtime";
import { cn } from "@/lib/utils";

const FETCH_TIMEOUT_MS = 15_000;

type ChannelSelection =
  | { kind: "all_staff"; id: string }
  | { kind: "group"; id: string }
  | { kind: "direct"; id: string }
  | null;

type GroupDetails = {
  id: string;
  name: string;
  members: TeamGroupMember[];
  canManage: boolean;
};

export default function TeamChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkConversation = searchParams.get("conversation");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [allStaff, setAllStaff] = useState<TeamChannelSummary | null>(null);
  const [groups, setGroups] = useState<TeamChannelSummary[]>([]);
  const [conversations, setConversations] = useState<TeamConversationSummary[]>([]);
  const [recipients, setRecipients] = useState<TeamRecipient[]>([]);
  const [canCreateGroups, setCanCreateGroups] = useState(false);
  const [selection, setSelection] = useState<ChannelSelection>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showManageGroup, setShowManageGroup] = useState(false);
  const [newRecipient, setNewRecipient] = useState<TeamRecipient | null>(null);
  const [newDraft, setNewDraft] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [session, setSession] = useState<{
    type: "owner" | "user";
    userId?: string;
  } | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const selectedId = selection?.id ?? null;
  selectedIdRef.current = selectedId;

  const loadConversations = useCallback(async () => {
    setLoadError(null);

    try {
      const res = await fetchWithTimeout("/api/admin/team-messages", undefined, FETCH_TIMEOUT_MS);
      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return null;
      }
      if (res.status === 403) {
        router.push("/platform/dashboard");
        return null;
      }

      const json = await parseAdminResponse(res);

      if (!res.ok || json.ok === false) {
        const message = json.message ?? `Could not load team messages (${res.status}).`;
        setLoadError(message);
        setSetupRequired(Boolean(json.setupRequired) || isTeamChatSetupError(message));
        setSetupMessage(
          typeof json.setupMessage === "string"
            ? json.setupMessage
            : isTeamChatSetupError(message)
              ? message
              : null
        );
        setLoading(false);
        return null;
      }

      setAllStaff((json.allStaff as TeamChannelSummary | null | undefined) ?? null);
      setGroups((json.groups as TeamChannelSummary[] | undefined) ?? []);
      setConversations((json.conversations as TeamConversationSummary[] | undefined) ?? []);
      setRecipients((json.recipients as TeamRecipient[] | undefined) ?? []);
      setCanCreateGroups(Boolean(json.canCreateGroups));
      setSetupRequired(Boolean(json.setupRequired));
      setSetupMessage(typeof json.setupMessage === "string" ? json.setupMessage : null);
      setLoading(false);
      return json;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load team messages. Check your connection.";
      setLoadError(message);
      setSetupRequired(isTeamChatSetupError(message));
      setLoading(false);
      return null;
    }
  }, [router]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      setMessagesError(null);

      try {
        const res = await fetchWithTimeout(
          `/api/admin/team-messages?conversationId=${encodeURIComponent(conversationId)}`,
          undefined,
          FETCH_TIMEOUT_MS
        );
        if (isAdminAuthError(res)) {
          router.push(adminLoginPath());
          return;
        }

        const json = await parseAdminResponse(res);
        if (!res.ok || json.ok === false) {
          setMessagesError(json.message ?? "Could not load messages.");
          setMessages([]);
          return;
        }

        setMessages((json.messages as TeamMessage[] | undefined) ?? []);
        await loadConversations();
      } catch (err) {
        setMessagesError(
          err instanceof Error ? err.message : "Could not load messages. Check your connection."
        );
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [router, loadConversations]
  );

  const loadGroupDetails = useCallback(async (groupId: string) => {
    const res = await fetch(
      `/api/admin/team-messages/groups?groupId=${encodeURIComponent(groupId)}`
    );
    if (!res.ok) return;
    const json = await res.json();
    setGroupDetails(json.group ?? null);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.user) return;
        setSession({
          type: json.user.type,
          userId: json.user.userId ?? undefined,
        });
      });
  }, []);

  const appendMessage = useCallback((message: TeamMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const refreshInbox = useCallback(() => {
    void loadConversations();
  }, [loadConversations]);

  useTeamChatRealtime({
    conversationId: selectedId,
    session,
    onNewMessage: (message) => {
      if (message.conversation_id === selectedIdRef.current) {
        appendMessage(message);
      }
      void loadConversations();
    },
    onInboxUpdate: refreshInbox,
    enabled: Boolean(session) && !loading,
  });

  useEffect(() => {
    if (!deepLinkConversation || loading) return;
    if (allStaff?.id === deepLinkConversation) {
      setSelection({ kind: "all_staff", id: deepLinkConversation });
      return;
    }
    const group = groups.find((g) => g.id === deepLinkConversation);
    if (group) {
      setSelection({ kind: "group", id: group.id });
      return;
    }
    const direct = conversations.find((c) => c.id === deepLinkConversation);
    if (direct) {
      setSelection({ kind: "direct", id: direct.id });
      return;
    }
    setSelection({ kind: "direct", id: deepLinkConversation });
  }, [deepLinkConversation, loading, allStaff, groups, conversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setGroupDetails(null);
      return;
    }
    void loadMessages(selectedId);
    if (selection?.kind === "group") {
      void loadGroupDetails(selectedId);
    } else {
      setGroupDetails(null);
    }
  }, [selectedId, selection?.kind, loadMessages, loadGroupDetails]);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.lastMessage?.body.toLowerCase().includes(q) ?? false)
    );
  }, [groups, search]);

  const filteredDirect = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.other.name.toLowerCase().includes(q) ||
        c.other.email.toLowerCase().includes(q) ||
        (c.lastMessage?.body.toLowerCase().includes(q) ?? false)
    );
  }, [conversations, search]);

  const showAllStaff =
    !search ||
    "all staff".includes(search.toLowerCase()) ||
    (allStaff?.lastMessage?.body.toLowerCase().includes(search.toLowerCase()) ?? false);

  const selectedDirect = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId]
  );

  useEffect(() => {
    if (selection || showNewChat || showCreateGroup || deepLinkConversation) return;
    if (allStaff) {
      setSelection({ kind: "all_staff", id: allStaff.id });
    } else if (filteredGroups[0]) {
      setSelection({ kind: "group", id: filteredGroups[0].id });
    } else if (filteredDirect[0]) {
      setSelection({ kind: "direct", id: filteredDirect[0].id });
    }
  }, [allStaff, filteredGroups, filteredDirect, selection, showNewChat, showCreateGroup, deepLinkConversation]);

  const staffForGroups = useMemo(
    () => recipients.filter((r) => r.userId && !r.isOwner),
    [recipients]
  );

  async function sendMessage(body: string, conversationId?: string, recipient?: TeamRecipient) {
    setSending(true);
    setSendError(null);

    const payload: Record<string, string | boolean> = { body };
    if (conversationId) payload.conversationId = conversationId;
    if (recipient) {
      if (recipient.isOwner) payload.recipientIsOwner = true;
      else if (recipient.userId) payload.recipientUserId = recipient.userId;
    }

    const res = await fetch("/api/admin/team-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setSending(false);

    if (!res.ok) {
      setSendError(json.message ?? "Could not send message.");
      return false;
    }

    setDraft("");
    setNewDraft("");
    setShowNewChat(false);
    setNewRecipient(null);

    const nextId = json.conversationId as string;
    const sentMessage = json.message as TeamMessage | undefined;
    if (sentMessage) {
      appendMessage(sentMessage);
    }

    setSelection((prev) => {
      if (prev?.id === nextId) return prev;
      if (allStaff?.id === nextId) return { kind: "all_staff", id: nextId };
      if (groups.some((g) => g.id === nextId)) return { kind: "group", id: nextId };
      return { kind: "direct", id: nextId };
    });

    await loadConversations();
    if (!sentMessage) {
      await loadMessages(nextId);
    }
    return true;
  }

  async function createGroup() {
    if (!groupName.trim() || groupMemberIds.length === 0) return;
    setGroupSaving(true);
    setSendError(null);

    const res = await fetch("/api/admin/team-messages/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName.trim(), memberUserIds: groupMemberIds }),
    });

    const json = await res.json();
    setGroupSaving(false);

    if (!res.ok) {
      setSendError(json.message ?? "Could not create group.");
      return;
    }

    setShowCreateGroup(false);
    setGroupName("");
    setGroupMemberIds([]);
    const groupId = json.groupId as string;
    setSelection({ kind: "group", id: groupId });
    await loadConversations();
    await loadMessages(groupId);
  }

  async function saveGroupMembers() {
    if (!groupDetails) return;
    setGroupSaving(true);
    setSendError(null);

    const memberUserIds = groupMemberIds.length > 0
      ? groupMemberIds
      : groupDetails.members.filter((m) => m.userId).map((m) => m.userId!);

    const res = await fetch("/api/admin/team-messages/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: groupDetails.id,
        name: groupName.trim() || groupDetails.name,
        memberUserIds,
      }),
    });

    const json = await res.json();
    setGroupSaving(false);

    if (!res.ok) {
      setSendError(json.message ?? "Could not update group.");
      return;
    }

    setShowManageGroup(false);
    await loadConversations();
    await loadGroupDetails(groupDetails.id);
  }

  function openManageGroup() {
    if (!groupDetails) return;
    setGroupName(groupDetails.name);
    setGroupMemberIds(
      groupDetails.members.filter((m) => m.userId).map((m) => m.userId!)
    );
    setShowManageGroup(true);
  }

  function toggleGroupMember(userId: string) {
    setGroupMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const unreadTotal =
    conversations.reduce((sum, c) => sum + c.unreadCount, 0) +
    groups.reduce((sum, g) => sum + g.unreadCount, 0) +
    (allStaff?.unreadCount ?? 0);

  function renderChannelButton(
    label: string,
    subtitle: string,
    id: string,
    kind: ChannelSelection extends infer S ? S extends { kind: infer K } ? K : never : never,
    unreadCount: number,
    icon: ReactNode,
    lastMessage?: { sender_name: string; body: string } | null
  ) {
    const active = selection?.id === id && selection?.kind === kind && !showNewChat && !showCreateGroup;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => {
            setShowNewChat(false);
            setShowCreateGroup(false);
            setSelection({ kind, id } as ChannelSelection);
          }}
          className={cn(
            "w-full px-4 py-3 text-left transition-colors",
            active ? "bg-[rgba(139,92,246,0.08)]" : "hover:bg-[rgba(76,29,149,0.04)]"
          )}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-violet-600">{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{label}</p>
                {unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">{subtitle}</p>
              {lastMessage && (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--platform-text-secondary)]">
                  {lastMessage.sender_name}: {lastMessage.body}
                </p>
              )}
            </div>
          </div>
        </button>
      </li>
    );
  }

  function openCreateGroup() {
    if (setupRequired) return;
    setShowCreateGroup(true);
    setShowNewChat(false);
    setSelection(null);
    setMessages([]);
    setGroupName("");
    setGroupMemberIds([]);
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading team messages…</p>;
  }

  if (loadError && !allStaff && groups.length === 0 && conversations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Messages"
          description="All-staff channel, custom groups, and direct messages between your team."
          breadcrumb="Team Messages"
        />
        <div className="platform-card rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--platform-text)]">
                {setupRequired ? "Group channels temporarily unavailable" : "Could not load team messages"}
              </p>
              <p className="text-sm text-[var(--platform-text-secondary)]">
                {setupRequired
                  ? "Direct messages still work. Group and All Staff channels will appear once setup is complete."
                  : (setupMessage ?? loadError)}
              </p>
              <button
                type="button"
                className="platform-btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  setLoading(true);
                  void loadConversations();
                }}
              >
                <RefreshCw className="size-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const threadTitle =
    selection?.kind === "all_staff"
      ? "All Staff"
      : selection?.kind === "group"
        ? selectedGroup?.name ?? groupDetails?.name ?? "Group"
        : selectedDirect?.other.name ?? "";

  const threadSubtitle =
    selection?.kind === "all_staff"
      ? "Company-wide chat · all active staff"
      : selection?.kind === "group"
        ? `${selectedGroup?.memberCount ?? groupDetails?.members.length ?? 0} members`
        : selectedDirect
          ? `${participantLabel(selectedDirect.other)} · ${selectedDirect.other.email}`
          : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Messages"
        description="All-staff channel, custom groups, and direct messages between your team."
        breadcrumb="Team Messages"
      />

      {setupRequired && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3 text-sm text-[var(--platform-text-secondary)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium text-[var(--platform-text)]">Group channels temporarily unavailable</p>
            <p className="mt-1">
              {setupMessage && !/migration/i.test(setupMessage)
                ? setupMessage
                : "Direct messages still work. Group and All Staff channels will appear once setup is complete."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels and conversations…"
            className="platform-input platform-input--icon"
          />
        </div>
        <button
          type="button"
          className="platform-btn-primary inline-flex items-center gap-2"
          onClick={() => {
            setShowNewChat(true);
            setShowCreateGroup(false);
            setSelection(null);
            setMessages([]);
          }}
        >
          <Plus className="size-4" />
          Direct message
        </button>
        {unreadTotal > 0 && (
          <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            {unreadTotal} unread
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr] xl:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="platform-scrollbar max-h-[min(70vh,36rem)] overflow-y-auto">
            {showAllStaff && allStaff && (
              <div>
                <div className="border-b border-[var(--platform-border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                  Company
                </div>
                <ul className="divide-y divide-[var(--platform-border)]">
                  {renderChannelButton(
                    "All Staff",
                    `${allStaff.memberCount} members`,
                    allStaff.id,
                    "all_staff",
                    allStaff.unreadCount,
                    <Users className="size-4" />,
                    allStaff.lastMessage
                  )}
                </ul>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 border-b border-t border-[var(--platform-border)] px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                  Groups
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--platform-text-secondary)]">
                    {filteredGroups.length}
                  </span>
                  {canCreateGroups && !setupRequired ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-700"
                      onClick={openCreateGroup}
                    >
                      <Plus className="size-3" />
                      New Group
                    </button>
                  ) : setupRequired ? (
                    <span
                      className="text-[10px] text-[var(--platform-text-secondary)]"
                      title="Group channels temporarily unavailable"
                    >
                      Setup pending
                    </span>
                  ) : null}
                </div>
              </div>
              <ul className="divide-y divide-[var(--platform-border)]">
                {filteredGroups.length === 0 ? (
                  <li className="px-4 py-6 text-center text-xs text-[var(--platform-text-secondary)]">
                    {setupRequired
                      ? "Group channels are temporarily unavailable. Direct messages still work."
                      : canCreateGroups
                        ? "No groups yet. Click + New Group above to message selected staff."
                        : "No groups yet. Ask your manager to create a group."}
                  </li>
                ) : (
                  filteredGroups.map((group) =>
                    renderChannelButton(
                      group.name,
                      `${group.memberCount} members`,
                      group.id,
                      "group",
                      group.unreadCount,
                      <Users className="size-4" />,
                      group.lastMessage
                    )
                  )
                )}
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between border-b border-t border-[var(--platform-border)] px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                  Direct messages
                </span>
                <span className="text-[10px] text-[var(--platform-text-secondary)]">
                  {filteredDirect.length}
                </span>
              </div>
              <ul className="divide-y divide-[var(--platform-border)]">
                {filteredDirect.length === 0 ? (
                  <li className="px-4 py-6 text-center text-xs text-[var(--platform-text-secondary)]">
                    No direct conversations yet.
                  </li>
                ) : (
                  filteredDirect.map((conv) => (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewChat(false);
                          setShowCreateGroup(false);
                          setSelection({ kind: "direct", id: conv.id });
                        }}
                        className={cn(
                          "w-full px-4 py-3 text-left transition-colors",
                          selection?.id === conv.id &&
                            selection?.kind === "direct" &&
                            !showNewChat &&
                            !showCreateGroup
                            ? "bg-[rgba(139,92,246,0.08)]"
                            : "hover:bg-[rgba(76,29,149,0.04)]"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <UserRound className="mt-0.5 size-4 text-violet-600" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-medium">{conv.other.name}</p>
                              {conv.unreadCount > 0 && (
                                <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
                              {participantLabel(conv.other)}
                            </p>
                            {conv.lastMessage && (
                              <p className="mt-1 line-clamp-2 text-xs text-[var(--platform-text-secondary)]">
                                {conv.lastMessage.sender_name}: {conv.lastMessage.body}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="platform-card min-h-[min(70vh,36rem)] rounded-xl p-0">
          {showCreateGroup ? (
            <GroupForm
              title="Create group"
              description="Name your group and select staff members to include."
              groupName={groupName}
              onGroupNameChange={setGroupName}
              staff={staffForGroups}
              selectedIds={groupMemberIds}
              onToggleMember={toggleGroupMember}
              saving={groupSaving}
              error={sendError}
              onCancel={() => {
                setShowCreateGroup(false);
                if (allStaff) setSelection({ kind: "all_staff", id: allStaff.id });
              }}
              onSave={() => void createGroup()}
              saveLabel="Create group"
            />
          ) : showManageGroup && groupDetails ? (
            <GroupForm
              title="Manage group"
              description="Update the group name or member list."
              groupName={groupName}
              onGroupNameChange={setGroupName}
              staff={staffForGroups}
              selectedIds={groupMemberIds}
              onToggleMember={toggleGroupMember}
              saving={groupSaving}
              error={sendError}
              onCancel={() => setShowManageGroup(false)}
              onSave={() => void saveGroupMembers()}
              saveLabel="Save changes"
            />
          ) : showNewChat ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--platform-border)] px-5 py-4">
                <h2 className="text-lg font-semibold">New direct message</h2>
                <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                  Choose a team member to message privately.
                </p>
              </div>
              <div className="platform-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-2">
                  <label
                    htmlFor="recipient"
                    className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]"
                  >
                    Recipient
                  </label>
                  <select
                    id="recipient"
                    value={
                      newRecipient
                        ? newRecipient.isOwner
                          ? "owner"
                          : newRecipient.userId ?? ""
                        : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      const found =
                        value === "owner"
                          ? recipients.find((r) => r.isOwner) ?? null
                          : recipients.find((r) => r.userId === value) ?? null;
                      setNewRecipient(found);
                    }}
                    className="platform-select"
                  >
                    <option value="">Select recipient…</option>
                    {recipients.map((r) => (
                      <option
                        key={r.isOwner ? "owner" : r.userId!}
                        value={r.isOwner ? "owner" : r.userId!}
                      >
                        {r.name} ({participantLabel(r)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="new-message"
                    className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]"
                  >
                    Message
                  </label>
                  <textarea
                    id="new-message"
                    value={newDraft}
                    onChange={(e) => setNewDraft(e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm"
                    placeholder="Write your first message…"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--platform-border)] px-5 py-4">
                <button
                  type="button"
                  className="platform-btn-ghost"
                  onClick={() => {
                    setShowNewChat(false);
                    if (allStaff) setSelection({ kind: "all_staff", id: allStaff.id });
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="platform-btn-primary inline-flex items-center gap-2"
                  disabled={sending || !newRecipient || !newDraft.trim()}
                  onClick={() => void sendMessage(newDraft.trim(), undefined, newRecipient!)}
                >
                  <Send className="size-4" />
                  {sending ? "Sending…" : "Start conversation"}
                </button>
                {sendError && <p className="text-sm text-red-600">{sendError}</p>}
              </div>
            </div>
          ) : !selection ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 p-8 text-center text-[var(--platform-text-secondary)]">
              <MessagesSquare className="size-8 opacity-40" />
              <p className="text-sm">Select a channel or start a conversation.</p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--platform-border)] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">{threadTitle}</h2>
                  <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                    {threadSubtitle}
                  </p>
                </div>
                {selection.kind === "group" && groupDetails?.canManage && (
                  <button
                    type="button"
                    className="platform-btn-ghost inline-flex items-center gap-1.5 text-sm"
                    onClick={openManageGroup}
                  >
                    <Settings2 className="size-4" />
                    Manage
                  </button>
                )}
              </div>

              <div className="platform-scrollbar flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messagesLoading ? (
                  <p className="text-sm text-[var(--platform-text-secondary)]">Loading messages…</p>
                ) : messagesError ? (
                  <div className="space-y-3">
                    <p className="text-sm text-red-600">{messagesError}</p>
                    <button
                      type="button"
                      className="platform-btn-secondary inline-flex items-center gap-2 text-sm"
                      onClick={() => selectedId && void loadMessages(selectedId)}
                    >
                      <RefreshCw className="size-4" />
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[var(--platform-text-secondary)]">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[85%] rounded-lg px-4 py-3 text-sm",
                        msg.isMine
                          ? "ml-auto bg-[rgba(139,92,246,0.12)] text-[var(--platform-text)]"
                          : "mr-auto border border-[var(--platform-border)] bg-[var(--platform-bg)]"
                      )}
                    >
                      {!msg.isMine && (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                          {msg.sender_name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p className="mt-1 text-[10px] text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={msg.created_at} className="text-[10px]" />
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3 border-t border-[var(--platform-border)] px-5 py-4">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="min-h-[4rem] flex-1 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm"
                  placeholder="Type a message…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim() && selectedId) {
                        void sendMessage(draft.trim(), selectedId);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="platform-btn-primary inline-flex items-center gap-2"
                  disabled={sending || !draft.trim()}
                  onClick={() => void sendMessage(draft.trim(), selectedId!)}
                >
                  <Send className="size-4" />
                  {sending ? "Sending…" : "Send"}
                </button>
                {sendError && <p className="w-full text-sm text-red-600">{sendError}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupForm({
  title,
  description,
  groupName,
  onGroupNameChange,
  staff,
  selectedIds,
  onToggleMember,
  saving,
  error,
  onCancel,
  onSave,
  saveLabel,
}: {
  title: string;
  description: string;
  groupName: string;
  onGroupNameChange: (value: string) => void;
  staff: TeamRecipient[];
  selectedIds: string[];
  onToggleMember: (userId: string) => void;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--platform-border)] px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">{description}</p>
      </div>
      <div className="platform-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="space-y-2">
          <label
            htmlFor="group-name"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]"
          >
            Group name
          </label>
          <input
            id="group-name"
            value={groupName}
            onChange={(e) => onGroupNameChange(e.target.value)}
            className="platform-input"
            placeholder="e.g. Sales team, Managers"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Members
          </p>
          <ul className="divide-y divide-[var(--platform-border)] rounded-lg border border-[var(--platform-border)]">
            {staff.map((member) => (
              <li key={member.userId!}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[rgba(76,29,149,0.04)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(member.userId!)}
                    onChange={() => onToggleMember(member.userId!)}
                    className="size-4 rounded border-[var(--platform-border)] text-violet-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{member.name}</span>
                    <span className="block text-xs text-[var(--platform-text-secondary)]">
                      {participantLabel(member)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--platform-border)] px-5 py-4">
        <button type="button" className="platform-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="platform-btn-primary"
          disabled={saving || !groupName.trim() || selectedIds.length === 0}
          onClick={onSave}
        >
          {saving ? "Saving…" : saveLabel}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
