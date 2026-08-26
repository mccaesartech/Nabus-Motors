"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, MessageSquarePlus, Search, Send, Trash2, User } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { CustomerMessageReplyAssist } from "@/components/platform/customer-message-reply-assist";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { useCustomerChatRealtime } from "@/lib/customer/realtime";
import {
  CUSTOMER_MESSAGE_CATEGORIES,
  customerOptionValue,
  parseCustomerSelection,
  type CustomerChatMessage,
  type CustomerConversation,
  type CustomerProfileOption,
  type PlatformUserOption,
} from "@/lib/customer/types";
import { canOversightCustomerTickets } from "@/lib/platform/permissions";
import type { NotificationFeedbackVariant } from "@/lib/notifications/notification-status";
import { cn } from "@/lib/utils";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

function categoryLabel(value: string) {
  return CUSTOMER_MESSAGE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function statusBadgeClass(status: string) {
  if (status === "open") return "bg-amber-100 text-amber-900";
  if (status === "available") return "bg-sky-100 text-sky-900";
  if (status === "claimed") return "bg-emerald-100 text-emerald-900";
  return "bg-slate-100 text-slate-700";
}

type QueueTab = "all" | "open" | "mine" | "unassigned" | "closed";
type StatusFilter = "all" | "open" | "closed";

function conversationIsUnassigned(conv: CustomerConversation): boolean {
  return !conv.assigned_to;
}

function assigneeFilterValue(conv: CustomerConversation): string {
  if (!conv.assigned_to) return "unassigned";
  if (conv.assigned_to.is_owner) return "owner";
  return conv.assigned_to.user_id ?? "unassigned";
}

export default function PlatformMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = usePlatformSession();
  const [conversations, setConversations] = useState<CustomerConversation[]>([]);
  const [customers, setCustomers] = useState<CustomerProfileOption[]>([]);
  const [platformUsers, setPlatformUsers] = useState<PlatformUserOption[]>([]);
  const [canOversight, setCanOversight] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [messages, setMessages] = useState<CustomerChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [queueTab, setQueueTab] = useState<QueueTab>("open");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("conversation")
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<CustomerConversation | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<NotificationFeedbackVariant>("success");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newDraft, setNewDraft] = useState("");
  const [newPartsOrderId, setNewPartsOrderId] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [newAssignTo, setNewAssignTo] = useState("");
  const [replyAssistKey, setReplyAssistKey] = useState(0);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const composeUrlHydratedRef = useRef<string | null>(null);

  const sessionCanOversight = useMemo(() => {
    if (!session) return false;
    return canOversightCustomerTickets(session.role);
  }, [session]);

  useEffect(() => {
    if (sessionCanOversight || canOversight) {
      setQueueTab((tab) => (tab === "open" ? "all" : tab));
    }
  }, [sessionCanOversight, canOversight]);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/admin/customer-messages?customers=1");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setConversations(json.conversations ?? []);
    setCustomers(json.customers ?? []);
    setPlatformUsers(json.platformUsers ?? []);
    setCanOversight(Boolean(json.canOversight));
    setCanDelete(Boolean(json.canDelete));
    setLoading(false);
  }, [router]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    const res = await fetch(
      `/api/admin/customer-messages?conversationId=${encodeURIComponent(conversationId)}`
    );
    if (res.ok) {
      const json = await res.json();
      setMessages(json.messages ?? []);
    } else {
      setMessages([]);
      const json = await res.json().catch(() => ({}));
      setSaveError(json.message ?? "Could not load conversation.");
    }
    setMessagesLoading(false);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const clearComposeUrlParams = useCallback(
    (conversationId?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of ["draft", "user", "email", "name", "phone", "subject", "order"]) {
        params.delete(key);
      }
      if (conversationId) {
        params.set("conversation", conversationId);
      }
      const qs = params.toString();
      router.replace(qs ? `/platform/messages?${qs}` : "/platform/messages", {
        scroll: false,
      });
      composeUrlHydratedRef.current = null;
    },
    [router, searchParams]
  );

  const resetComposeFields = useCallback(() => {
    setDraft("");
    setNewDraft("");
    setNewSubject("");
    setNewPartsOrderId("");
    setNewCustomerId("");
    setNewAssignTo("");
    setReplyAssistKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
    const conv = searchParams.get("conversation");
    if (conv) setSelectedId(conv);

    const user = searchParams.get("user");
    const email = searchParams.get("email");
    const subject = searchParams.get("subject");
    const orderId = searchParams.get("order");
    const urlDraft = searchParams.get("draft");
    if (!user && !email && !subject && !orderId && !urlDraft) {
      return;
    }

    const composeSignature = [user, email, subject, orderId, urlDraft].join("|");
    if (composeUrlHydratedRef.current === composeSignature) {
      return;
    }

    composeUrlHydratedRef.current = composeSignature;
    if (subject) setNewSubject(subject);
    if (orderId) setNewPartsOrderId(orderId);
    if (urlDraft) setNewDraft(urlDraft);
    if (user) {
      setNewCustomerId(user);
      setShowNewChat(true);
      setSelectedId(null);
    } else if (email) {
      setNewCustomerId(`email:${email}`);
      setShowNewChat(true);
      setSelectedId(null);
    }
  }, [searchParams]);

  const urlCustomer = useMemo((): CustomerProfileOption | null => {
    const user = searchParams.get("user");
    const email = searchParams.get("email");
    const name = searchParams.get("name");
    if (user) {
      const match = customers.find((c) => c.userId === user);
      return (
        match ?? {
          userId: user,
          email: email ?? "",
          name: name ?? "Customer",
          registration_id: null,
        }
      );
    }
    if (email) {
      const normalized = email.trim().toLowerCase();
      const match = customers.find(
        (c) => c.email.trim().toLowerCase() === normalized
      );
      return (
        match ?? {
          userId: null,
          email,
          name: name ?? email.split("@")[0] ?? "Customer",
          registration_id: null,
        }
      );
    }
    return null;
  }, [customers, searchParams]);

  const customerOptions = useMemo(() => {
    if (!urlCustomer) return customers;
    const value = customerOptionValue(urlCustomer);
    if (customers.some((c) => customerOptionValue(c) === value)) return customers;
    return [...customers, urlCustomer];
  }, [customers, urlCustomer]);

  const filtered = useMemo(() => {
    const oversight = canOversight || sessionCanOversight;

    return conversations.filter((conv) => {
      if (oversight) {
        if (queueTab === "mine") {
          if (!conv.isAssignedToMe || conv.status === "closed") return false;
        } else if (queueTab === "unassigned") {
          if (!conversationIsUnassigned(conv) || conv.status === "closed") return false;
        } else if (queueTab === "closed") {
          if (conv.status !== "closed") return false;
        } else if (queueTab === "all") {
          // show everything
        }
      } else if (queueTab === "open") {
        if (!(conv.status === "open" || conv.status === "available")) return false;
        if (conv.isAssignedToMe) return false;
      } else if (queueTab === "mine") {
        if (!conv.isAssignedToMe) return false;
        if (conv.status === "closed") return false;
      } else if (conv.status !== "closed") {
        return false;
      }

      if (oversight && statusFilter === "open" && conv.status === "closed") {
        return false;
      }
      if (oversight && statusFilter === "closed" && conv.status !== "closed") {
        return false;
      }

      if (oversight && assigneeFilter !== "all") {
        if (assigneeFilterValue(conv) !== assigneeFilter) return false;
      }

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        conv.customer_name.toLowerCase().includes(q) ||
        conv.customer_email.toLowerCase().includes(q) ||
        conv.subject.toLowerCase().includes(q) ||
        (conv.registration_id?.toLowerCase().includes(q) ?? false) ||
        (conv.preorder_title?.toLowerCase().includes(q) ?? false) ||
        (conv.parts_order_label?.toLowerCase().includes(q) ?? false) ||
        (conv.assigned_to?.name?.toLowerCase().includes(q) ?? false) ||
        (conv.lastMessage?.body.toLowerCase().includes(q) ?? false)
      );
    });
  }, [conversations, search, queueTab, canOversight, sessionCanOversight, statusFilter, assigneeFilter]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    if (!selectedId && filtered.length > 0 && !showNewChat) {
      setSelectedId(filtered[0].id);
    }
    if (selectedId && !filtered.some((c) => c.id === selectedId) && !showNewChat) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId, showNewChat]);

  useEffect(() => {
    if (!selected) return;
    setSaveError(null);
    void loadMessages(selected.id);
  }, [selected, loadMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appendMessage = useCallback((message: CustomerChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) {
        return prev.map((m) => (m.id === message.id ? message : m));
      }
      return [...prev, message];
    });
  }, []);

  const mergeConversation = useCallback((updated: CustomerConversation) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === updated.id ? updated : conv))
    );
  }, []);

  useCustomerChatRealtime({
    conversationId: selected?.id ?? null,
    viewer: "staff",
    onNewMessage: appendMessage,
    onInboxUpdate: loadConversations,
    enabled: !loading,
  });

  async function claimTicket(conversationId: string) {
    setClaiming(true);
    setSaveError(null);
    const res = await fetch("/api/admin/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim", id: conversationId }),
    });
    const json = await res.json();
    setClaiming(false);
    if (!res.ok) {
      setSaveError(json.message ?? "Could not accept ticket.");
      return;
    }
    setQueueTab("mine");
    setSelectedId(conversationId);
    if (json.conversation) {
      mergeConversation(json.conversation as CustomerConversation);
    } else {
      await loadConversations();
    }
    await loadMessages(conversationId);
  }

  async function closeTicket(conversationId: string) {
    setClosing(true);
    setSaveError(null);
    const res = await fetch("/api/admin/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close",
        id: conversationId,
        resolutionNote: closeNote,
      }),
    });
    const json = await res.json();
    setClosing(false);
    if (!res.ok) {
      setSaveError(json.message ?? "Could not close ticket.");
      return;
    }
    setCloseNote("");
    setQueueTab("closed");
    if (json.conversation) {
      mergeConversation(json.conversation as CustomerConversation);
    } else {
      await loadConversations();
    }
  }

  async function reassignTicket(conversationId: string, assignTo: string) {
    setReassigning(true);
    setSaveError(null);
    const res = await fetch("/api/admin/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reassign", id: conversationId, assignTo }),
    });
    const json = await res.json();
    setReassigning(false);
    if (!res.ok) {
      setSaveError(json.message ?? "Could not reassign ticket.");
      return;
    }
    setReassignTo("");
    if (json.conversation) {
      mergeConversation(json.conversation as CustomerConversation);
    } else {
      await loadConversations();
    }
  }

  async function deleteTickets(ids: string[]) {
    if (ids.length === 0) return;
    setDeleting(true);
    setSaveError(null);
    const idSet = new Set(ids);
    const snapshot = conversations;
    setConversations((prev) => prev.filter((conv) => !idSet.has(conv.id)));
    if (selectedId && idSet.has(selectedId)) {
      setSelectedId(null);
      setMessages([]);
    }
    setDeleteTarget(null);
    setBulkDeleteConfirm(false);

    const res = await fetch("/api/admin/customer-messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setConversations(snapshot);
      setSaveError(json.message ?? "Could not delete ticket(s).");
      setToast(json.message ?? "Could not delete ticket(s).");
      setToastVariant("warning");
      return;
    }

    const deleted = new Set<string>(
      Array.isArray(json.deletedIds) ? json.deletedIds.map(String) : ids
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of deleted) next.delete(id);
      return next;
    });
    setToast(
      json.message ??
        (deleted.size === 1
          ? "Ticket moved to trash."
          : `${deleted.size} tickets moved to trash.`)
    );
    setToastVariant("success");
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    const visibleIds = filtered.map((c) => c.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function sendMessage(
    body: string,
    conversationId?: string,
    customerSelection?: string,
    subject?: string,
    partsOrderId?: string
  ) {
    const trimmedBody = body.trim();
    if (!trimmedBody) return false;

    setSending(true);
    setSaveError(null);

    const customer = customerSelection ? parseCustomerSelection(customerSelection) : {};
    const urlName = searchParams.get("name");
    const urlPhone = searchParams.get("phone");

    const res = await fetch("/api/admin/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: trimmedBody,
        conversationId,
        userId: customer.userId,
        email: customer.email,
        name: urlName ?? undefined,
        phone: urlPhone ?? undefined,
        subject,
        partsOrderId: partsOrderId || undefined,
        category: newCategory,
        ...(newAssignTo && newAssignTo !== "self"
          ? {
              assignTo: newAssignTo,
              assignToIsOwner: newAssignTo === "owner",
              assignToUserId:
                newAssignTo !== "owner" && newAssignTo !== "unassigned"
                  ? newAssignTo
                  : undefined,
              assignToUnassigned: newAssignTo === "unassigned",
            }
          : {}),
      }),
    });

    const json = await res.json();
    setSending(false);

    if (!res.ok || json.ok === false) {
      setSaveError(json.message ?? "Could not send message.");
      return false;
    }

    if (json.notificationMessage) {
      setToast(String(json.notificationMessage));
      setToastVariant((json.notificationVariant as NotificationFeedbackVariant) ?? "success");
    }

    resetComposeFields();
    setShowNewChat(false);
    clearComposeUrlParams(json.conversationId as string);

    const nextId = json.conversationId as string;
    if (json.message) appendMessage(json.message as CustomerChatMessage);
    setSelectedId(nextId);
    if (!conversationId) {
      setQueueTab("mine");
    }
    await loadConversations();
    if (!json.message) await loadMessages(nextId);
    requestAnimationFrame(() => replyTextareaRef.current?.focus());
    return true;
  }

  const oversight = canOversight || sessionCanOversight;

  const openQueueCount = conversations.filter(
    (c) =>
      (c.status === "open" || c.status === "available") &&
      !c.isAssignedToMe
  ).length;
  const mineCount = conversations.filter(
    (c) => c.isAssignedToMe && c.status !== "closed"
  ).length;
  const allCount = conversations.length;
  const unassignedCount = conversations.filter(
    (c) => conversationIsUnassigned(c) && c.status !== "closed"
  ).length;
  const closedCount = conversations.filter((c) => c.status === "closed").length;
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const firstCustomerMessage = messages.find((m) => m.sender_type === "customer");

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading messages…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        description="Accept tickets from the queue, chat with customers, and hand off with full history when reopened."
        breadcrumb="Messages"
        actions={
          <button
            type="button"
            className="platform-btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setShowNewChat(true);
              setSelectedId(null);
              setMessages([]);
            }}
          >
            <MessageSquarePlus className="size-4" />
            New conversation
          </button>
        }
      />

      {toast && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            toastVariant === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text-secondary)]"
              : toastVariant === "neutral"
                ? "border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-secondary)]"
                : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          )}
        >
          {toast}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, agent, registration ID…"
            className="platform-input platform-input--icon"
          />
        </div>
        {oversight ? (
          <>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="platform-select"
            >
              <option value="all">All agents</option>
              <option value="unassigned">Unassigned</option>
              <option value="owner">Owner</option>
              {platformUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="platform-select"
            >
              <option value="all">All statuses</option>
              <option value="open">Open only</option>
              <option value="closed">Closed only</option>
            </select>
          </>
        ) : (
          <select
            value={queueTab}
            onChange={(e) => setQueueTab(e.target.value as QueueTab)}
            className="platform-select"
          >
            <option value="open">Open queue ({openQueueCount})</option>
            <option value="mine">My tickets ({mineCount})</option>
            <option value="closed">Closed</option>
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(oversight
          ? ([
              ["all", `All tickets (${allCount})`],
              ["mine", `My tickets (${mineCount})`],
              ["unassigned", `Unassigned (${unassignedCount})`],
              ["closed", `Closed (${closedCount})`],
            ] as const)
          : ([
              ["open", `Open (${openQueueCount})`],
              ["mine", `Mine (${mineCount})`],
              ["closed", `Closed (${closedCount})`],
            ] as const)
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setQueueTab(tab)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              queueTab === tab
                ? "bg-violet-600 text-white"
                : "bg-[var(--platform-bg)] text-[var(--platform-text-secondary)] hover:bg-[rgba(139,92,246,0.08)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {canDelete && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3 text-sm">
          <span>
            <span className="font-medium">{selectedIds.size}</span> selected
          </span>
          <button
            type="button"
            className="platform-btn-secondary inline-flex items-center gap-2 text-xs text-red-700"
            disabled={deleting}
            onClick={() => setBulkDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            Move to trash
          </button>
          <button
            type="button"
            className="platform-btn-ghost text-xs"
            disabled={deleting}
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr] xl:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--platform-border)] px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
            <span>
              {filtered.length} conversations
              {unreadTotal > 0 && (
                <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 font-bold text-white">
                  {unreadTotal} unread
                </span>
              )}
            </span>
            {canDelete && filtered.length > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 &&
                    filtered.every((c) => selectedIds.has(c.id))
                  }
                  onChange={toggleSelectAllFiltered}
                  className="size-3.5 rounded border-[var(--platform-border)]"
                  aria-label="Select all visible tickets"
                />
                Select all
              </label>
            )}
          </div>
          <ul className="platform-scrollbar max-h-[min(70vh,36rem)] divide-y divide-[var(--platform-border)] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-12 text-center text-sm text-[var(--platform-text-secondary)]">
                No customer conversations match your filters.
              </li>
            ) : (
              filtered.map((conv) => {
                const active = conv.id === selectedId && !showNewChat;
                return (
                  <li key={conv.id} className="flex items-stretch">
                    {canDelete && (
                      <div className="flex items-start px-2 pt-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(conv.id)}
                          onChange={() => toggleSelected(conv.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="size-3.5 rounded border-[var(--platform-border)]"
                          aria-label={`Select ${conv.subject}`}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewChat(false);
                        setSelectedId(conv.id);
                        setDraft("");
                        setReplyAssistKey((key) => key + 1);
                      }}
                      className={cn(
                        "min-w-0 flex-1 px-4 py-3 text-left transition-colors",
                        !canDelete && "w-full",
                        active
                          ? "bg-[rgba(139,92,246,0.08)]"
                          : "hover:bg-[rgba(76,29,149,0.04)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{conv.subject}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          {conv.unreadCount > 0 && (
                            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              statusBadgeClass(conv.status)
                            )}
                          >
                            {conv.status}
                          </span>
                        </div>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium">{conv.customer_name}</p>
                      <p className="truncate text-[10px] text-[var(--platform-text-secondary)]">
                        {conv.customer_email}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-[var(--platform-text-secondary)]">
                        Assigned to:{" "}
                        <span className="text-[var(--platform-text)]">
                          {conv.assigned_to?.name ?? "Unassigned"}
                        </span>
                      </p>
                      {conv.lastMessage && (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--platform-text-secondary)]">
                          {conv.lastMessage.sender_name}: {conv.lastMessage.body}
                        </p>
                      )}
                      {conv.lastMessage && (
                        <p className="mt-0.5 text-[10px] text-[var(--platform-text-secondary)]">
                          Last message{" "}
                          <PlatformDateTime
                            value={conv.lastMessage.created_at}
                            className="text-[10px]"
                          />
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-[var(--platform-text-secondary)]">
                        Opened <PlatformDateTime value={conv.created_at} className="text-[10px]" />
                        {conv.closed_at ? (
                          <>
                            {" "}
                            · Closed{" "}
                            <PlatformDateTime value={conv.closed_at} className="text-[10px]" />
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--platform-text-secondary)]">
                        {conv.registration_id && (
                          <span className="font-mono">{conv.registration_id} · </span>
                        )}
                        {categoryLabel(conv.category)}
                        {conv.preorder_title && (
                          <span> · Pre-order: {conv.preorder_title}</span>
                        )}
                        {conv.parts_order_label && (
                          <span> · {conv.parts_order_label}</span>
                        )}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="platform-card min-h-[min(70vh,36rem)] rounded-xl p-0">
          {showNewChat ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--platform-border)] px-5 py-4">
                <h2 className="text-lg font-semibold">Start a conversation</h2>
                <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                  Message any customer from your list — registered accounts, cart orders, and pre-order leads included.
                </p>
              </div>
              <div className="platform-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Customer
                  </label>
                  {customerOptions.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--platform-border)] px-3 py-4 text-sm text-[var(--platform-text-secondary)]">
                      No customers with email yet. Cart orders and website leads will appear here once submitted.
                    </p>
                  ) : (
                    <select
                      value={newCustomerId}
                      onChange={(e) => setNewCustomerId(e.target.value)}
                      className="platform-select w-full"
                    >
                      <option value="">Select a customer…</option>
                      {customerOptions.map((c) => (
                        <option key={customerOptionValue(c)} value={customerOptionValue(c)}>
                          {c.name} · {c.registration_id ?? c.email}
                          {!c.userId ? " (lead)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="platform-select w-full"
                  >
                    {CUSTOMER_MESSAGE_CATEGORIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {oversight && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                      Assign to
                    </label>
                    <select
                      value={newAssignTo}
                      onChange={(e) => setNewAssignTo(e.target.value)}
                      className="platform-select w-full"
                    >
                      <option value="self">Assign to me</option>
                      <option value="unassigned">Leave unassigned (queue)</option>
                      <option value="owner">Owner</option>
                      {platformUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Subject
                  </label>
                  <input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="platform-input w-full"
                    placeholder="e.g. Update on your pre-order"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Message
                  </label>
                  <textarea
                    value={newDraft}
                    onChange={(e) => setNewDraft(e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm"
                    placeholder="Write your message…"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--platform-border)] px-5 py-4">
                <button
                  type="button"
                  className="platform-btn-primary inline-flex items-center gap-2"
                  disabled={
                    sending ||
                    !newCustomerId ||
                    !newSubject.trim() ||
                    !newDraft.trim()
                  }
                  onClick={() =>
                    void sendMessage(
                      newDraft,
                      undefined,
                      newCustomerId,
                      newSubject.trim(),
                      newPartsOrderId || undefined
                    )
                  }
                >
                  <Send className="size-4" />
                  {sending ? "Sending…" : "Send message"}
                </button>
                <button
                  type="button"
                  className="platform-btn-secondary"
                  onClick={() => setShowNewChat(false)}
                >
                  Cancel
                </button>
                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              </div>
            </div>
          ) : !selected ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 p-8 text-center text-[var(--platform-text-secondary)]">
              <Mail className="size-8 opacity-40" />
              <p className="text-sm">Select a conversation or start a new one.</p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--platform-border)] px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                      {selected.customer_name} · {selected.customer_email}
                    </p>
                    <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                      Opened <PlatformDateTime value={selected.created_at} className="text-xs" />
                      {selected.closed_at ? (
                        <>
                          {" "}
                          · Closed <PlatformDateTime value={selected.closed_at} className="text-xs" />
                        </>
                      ) : null}
                      {selected.updated_at ? (
                        <>
                          {" "}
                          · Updated <PlatformDateTime value={selected.updated_at} className="text-xs" />
                        </>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
                      {selected.registration_id && (
                        <span className="font-mono">{selected.registration_id} · </span>
                      )}
                      {categoryLabel(selected.category)}
                      {selected.preorder_title && (
                        <span> · Pre-order: {selected.preorder_title}</span>
                      )}
                      {selected.parts_order_label && (
                        <span> · {selected.parts_order_label}</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--platform-text)]">
                      Handled by{" "}
                      <span className="text-[var(--platform-text-secondary)]">
                        {selected.assigned_to?.name ?? "Unassigned"}
                        {selected.assigned_to?.role_label
                          ? ` (${selected.assigned_to.role_label})`
                          : ""}
                      </span>
                    </p>
                    {selected.status === "closed" && selected.resolution_note && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        Resolution: {selected.resolution_note}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.canReassign && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={reassignTo}
                          onChange={(e) => setReassignTo(e.target.value)}
                          className="platform-select min-w-[10rem] text-xs"
                        >
                          <option value="">Reassign to…</option>
                          <option value="unassigned">Unassigned (queue)</option>
                          <option value="owner">Owner</option>
                          {platformUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="platform-btn-secondary text-xs"
                          disabled={!reassignTo || reassigning}
                          onClick={() => void reassignTicket(selected.id, reassignTo)}
                        >
                          {reassigning ? "Reassigning…" : "Reassign"}
                        </button>
                      </div>
                    )}
                    {selected.canClaim && (
                      <button
                        type="button"
                        className="platform-btn-primary text-xs"
                        disabled={claiming}
                        onClick={() => void claimTicket(selected.id)}
                      >
                        {claiming ? "Accepting…" : "Accept ticket"}
                      </button>
                    )}
                    {selected.canReply && (
                      <div className="flex flex-col gap-2 sm:items-end">
                        <input
                          value={closeNote}
                          onChange={(e) => setCloseNote(e.target.value)}
                          placeholder="Resolution note (optional)"
                          className="platform-input w-full min-w-[12rem] text-xs"
                        />
                        <button
                          type="button"
                          className="platform-btn-secondary text-xs"
                          disabled={closing}
                          onClick={() => void closeTicket(selected.id)}
                        >
                          {closing ? "Closing…" : "Close ticket"}
                        </button>
                      </div>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="platform-btn-secondary inline-flex items-center gap-1.5 text-xs text-red-700"
                        disabled={deleting}
                        onClick={() => setDeleteTarget(selected)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    )}
                    <span
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-semibold uppercase",
                        statusBadgeClass(selected.status)
                      )}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="platform-scrollbar flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messagesLoading ? (
                  <p className="text-sm text-[var(--platform-text-secondary)]">Loading thread…</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3 text-sm",
                        msg.isMine
                          ? "ml-auto bg-[rgba(139,92,246,0.12)] text-[var(--platform-text)]"
                          : "mr-auto border border-[var(--platform-border)] bg-[var(--platform-bg)]"
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-[var(--platform-text-secondary)]">
                        <User className="size-3" />
                        <span className="font-medium">
                          {msg.isMine
                            ? `You${msg.sender_role_label ? ` · ${msg.sender_role_label}` : ""}`
                            : msg.sender_type === "staff"
                              ? `${msg.sender_name}${msg.sender_role_label ? ` · ${msg.sender_role_label}` : " · Team"}`
                              : msg.sender_name}
                        </span>
                        <PlatformDateTime value={msg.created_at} className="text-xs" />
                      </div>
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              <div className="border-t border-[var(--platform-border)] px-5 py-4">
                <p className="mb-2 text-xs font-medium text-[var(--platform-text-secondary)]">
                  Your reply
                </p>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={replyTextareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    disabled={!selected.canReply}
                    className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 text-sm disabled:opacity-50"
                    placeholder={
                      selected.canClaim
                        ? "Accept this ticket to start replying…"
                        : selected.canReply
                          ? oversight && !selected.isAssignedToMe
                            ? "Reply as yourself (oversight)…"
                            : "Type a reply…"
                          : "Viewing conversation history — accept or wait for reassignment to reply."
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (draft.trim() && !sending) {
                          void sendMessage(draft, selected.id);
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="platform-btn-primary inline-flex shrink-0 items-center gap-2"
                    disabled={sending || !draft.trim() || !selected.canReply}
                    onClick={() => void sendMessage(draft, selected.id)}
                  >
                    <Send className="size-4" />
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </div>

              {firstCustomerMessage && selected && (
                <div className="border-t border-[var(--platform-border)] px-5 pb-4">
                  <CustomerMessageReplyAssist
                    key={replyAssistKey}
                    conversation={selected}
                    customerBody={firstCustomerMessage.body}
                    draft={draft}
                    onApplyDraft={setDraft}
                  />
                </div>
              )}
              {saveError && (
                <p className="px-5 pb-4 text-sm text-red-600">{saveError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title={deleteTarget ? `Delete “${deleteTarget.subject}”?` : "Delete ticket?"}
        description={
          deleteTarget
            ? `Move this support ticket with ${deleteTarget.customer_name} to trash? It will be removed from Messages but kept in Trash where it can be restored.`
            : ""
        }
        confirmLabel="Move to trash"
        busyLabel="Moving…"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => {
          if (!deleteTarget) return;
          return deleteTickets([deleteTarget.id]);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => {
          if (!open && !deleting) setBulkDeleteConfirm(false);
        }}
        title="Delete selected tickets?"
        description={`Move ${selectedIds.size} support ticket${selectedIds.size === 1 ? "" : "s"} to trash? They will be removed from Messages but kept in Trash where they can be restored.`}
        confirmLabel="Move to trash"
        busyLabel="Moving…"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => deleteTickets([...selectedIds])}
      />
    </div>
  );
}
