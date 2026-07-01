"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { ROLE_LABELS } from "@/lib/platform/permissions";
import type { PlatformUserInviteInfo, PlatformUserRow } from "@/lib/platform/modules";
import { formatPlatformDate } from "@/lib/platform/datetime";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type RoleLabels = Record<string, string>;

type EmailConfig = {
  configured: boolean;
  hasApiKey: boolean;
  hasFromAddress: boolean;
  missing: string[];
};

type InvitePanel = {
  userId: string;
  email: string;
  name: string;
  link: string;
  emailSent: boolean;
  emailError?: string;
};

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700",
    pending: "bg-amber-500/10 text-amber-700",
    disabled: "bg-slate-500/10 text-slate-600",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

function inviteStatusLabel(invite: PlatformUserInviteInfo) {
  if (invite.status === "accepted") {
    return invite.acceptedAt
      ? `Accepted ${formatPlatformDate(invite.acceptedAt)}`
      : "Accepted";
  }
  if (invite.status === "expired") return "Invite expired";
  if (invite.status === "active") return "Invite active";
  return "No invite";
}

function UserProfileCell({ user }: { user: PlatformUserRow }) {
  const hasProfile = Boolean(user.phone || user.job_title);

  if (!hasProfile) {
    return <span className="text-xs opacity-60">—</span>;
  }

  return (
    <div className="text-xs text-[var(--platform-text-secondary)]">
      {user.phone && <div>{user.phone}</div>}
      {user.job_title && <div>{user.job_title}</div>}
    </div>
  );
}

const inviteActionBtn =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--platform-border)] px-3 text-xs font-medium text-[var(--platform-text)] transition-colors hover:bg-[var(--platform-surface)] disabled:opacity-50 sm:min-w-0";

function InviteLinkCell({
  user,
  rowActionId,
  onCopyInvite,
  onRegenerateInvite,
  onResendInvite,
}: {
  user: PlatformUserRow;
  rowActionId: string | null;
  onCopyInvite: (user: PlatformUserRow) => void;
  onRegenerateInvite: (user: PlatformUserRow) => void;
  onResendInvite: (user: PlatformUserRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const invite = user.invite;
  const isPending = user.status === "pending";
  const isBusy = rowActionId === user.id;

  if (!isPending) {
    if (invite?.status === "accepted") {
      return (
        <span className="text-xs text-[var(--platform-text-secondary)]">
          {inviteStatusLabel(invite)}
        </span>
      );
    }
    return <span className="text-xs opacity-60">—</span>;
  }

  if (!invite || invite.status === "none") {
    return (
      <button
        type="button"
        onClick={() => onRegenerateInvite(user)}
        disabled={isBusy}
        className={`${inviteActionBtn} border-amber-500/40 bg-amber-500/10 text-amber-900`}
      >
        <RefreshCw className={`size-4 ${isBusy ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Generate link</span>
      </button>
    );
  }

  const hasUrl = Boolean(invite.inviteUrl);
  const needsRegenerate =
    !hasUrl || invite.status === "expired" || Boolean(invite.needsRegenerate);

  return (
    <div className="min-w-[220px] max-w-md space-y-2">
      <p className="text-xs text-[var(--platform-text-secondary)]">
        {inviteStatusLabel(invite)}
        {invite.expiresAt && invite.status === "active" && (
          <span> · until {formatPlatformDate(invite.expiresAt)}</span>
        )}
      </p>

      {hasUrl && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          title={invite.inviteUrl}
          className="w-full rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-left font-mono text-xs text-[var(--platform-text)] hover:border-[var(--platform-accent)]/40"
        >
          <span className={expanded ? "break-all whitespace-pre-wrap" : "block truncate"}>
            {invite.inviteUrl}
          </span>
          <span className="mt-1 block text-[10px] font-sans text-[var(--platform-text-secondary)]">
            {expanded ? "Tap to collapse" : "Tap to view full link"}
          </span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {hasUrl && (
          <>
            <button
              type="button"
              onClick={() => onCopyInvite(user)}
              disabled={isBusy}
              className={inviteActionBtn}
              title="Copy invite link"
            >
              <Copy className="size-4" />
              <span className="hidden sm:inline">Copy</span>
            </button>
            <a
              href={invite.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={inviteActionBtn}
              title="Open invite page"
            >
              <ExternalLink className="size-4" />
              <span className="hidden sm:inline">Open</span>
            </a>
          </>
        )}
        {needsRegenerate ? (
          <button
            type="button"
            onClick={() => onRegenerateInvite(user)}
            disabled={isBusy}
            className={`${inviteActionBtn} border-amber-500/40 bg-amber-500/10 text-amber-900`}
          >
            <RefreshCw className={`size-4 ${isBusy ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onResendInvite(user)}
            disabled={isBusy}
            className={inviteActionBtn}
            title="Resend invite email"
          >
            <Mail className="size-4" />
            <span className="hidden sm:inline">Resend</span>
          </button>
        )}
      </div>
    </div>
  );
}

function EmailSetupHelp({ compact = false }: { compact?: boolean }) {
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-amber-900 hover:text-amber-950 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        {compact ? "How to configure Resend email" : "Set up automatic invite emails (Resend)"}
      </summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-amber-900/90">
        <li>
          Create a free account at{" "}
          <a
            href="https://resend.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            resend.com
          </a>{" "}
          and verify your sending domain.
        </li>
        <li>
          In your Vercel project, open <strong>Settings → Environment Variables</strong> and add:
          <ul className="mt-1.5 list-disc space-y-1 pl-4 font-mono text-xs">
            <li>
              <code>RESEND_API_KEY</code> — API key from Resend dashboard
            </li>
            <li>
              <code>RESEND_FROM_EMAIL</code> — e.g.{" "}
              <code>True Goshen &lt;noreply@yourdomain.com&gt;</code>
            </li>
          </ul>
        </li>
        <li>Redeploy the site (or run a new production deploy) so the variables take effect.</li>
        <li>Return here and use <strong>Resend email</strong> on a pending user to test delivery.</li>
      </ol>
    </details>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleLabels, setRoleLabels] = useState<RoleLabels>({});
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "warning">("success");
  const [invitePanel, setInvitePanel] = useState<InvitePanel | null>(null);
  const [expandedInvitePanel, setExpandedInvitePanel] = useState(false);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [canViewInviteLinks, setCanViewInviteLinks] = useState(false);
  const [inviteSchemaWarning, setInviteSchemaWarning] = useState<string | null>(null);

  function ownerCanViewInviteLinks(
    usersPayload: { canViewInviteLinks?: boolean },
    sessionPayload: { ok?: boolean; user?: { type?: string; role?: string } }
  ) {
    if (usersPayload.canViewInviteLinks) return true;
    const user = sessionPayload.user;
    return Boolean(sessionPayload.ok && (user?.type === "owner" || user?.role === "owner"));
  }

  function applyInviteToUser(userId: string, link: string, expiresAt?: string) {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              invite: {
                status: "active" as const,
                inviteUrl: link,
                expiresAt,
              },
            }
          : user
      )
    );
  }

  const load = useCallback(async () => {
    const [usersRes, sessionRes] = await Promise.all([
      fetch("/api/admin/platform-users"),
      fetch("/api/admin/session"),
    ]);
    if (isAdminAuthError(usersRes)) {
      router.push(adminLoginPath());
      return;
    }
    if (usersRes.status === 403) {
      router.push("/platform/dashboard");
      return;
    }
    const json = await usersRes.json();
    const sessionJson = sessionRes.ok ? await sessionRes.json() : { ok: false };
    setUsers(json.users ?? []);
    setRoles(json.roles ?? []);
    setRoleLabels(json.roleLabels ?? ROLE_LABELS);
    setEmailConfig(json.emailConfig ?? null);
    const ownerViewer = ownerCanViewInviteLinks(json, sessionJson);
    setCanViewInviteLinks(ownerViewer);
    setInviteSchemaWarning(
      ownerViewer && json.inviteLinksSchemaReady === false
        ? (json.inviteLinksSchemaError ??
            "Invite links are unavailable until database migration 026 is applied in Supabase.")
        : null
    );
    if (json.roles?.length) setRole(json.roles.includes(role) ? role : json.roles[0]);
    setLoading(false);
  }, [router, role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (invitePanel && !users.some((user) => user.id === invitePanel.userId)) {
      setInvitePanel(null);
    }
  }, [users, invitePanel]);

  function showInvitePanel(
    userId: string,
    invitedEmail: string,
    invitedName: string,
    json: { inviteLink?: string; inviteUrl?: string; emailSent?: boolean; emailError?: string },
    resent = false
  ) {
    const link = json.inviteLink ?? json.inviteUrl ?? "";
    if (!link) return;

    setInvitePanel({
      userId,
      email: invitedEmail,
      name: invitedName,
      link,
      emailSent: Boolean(json.emailSent),
      emailError: json.emailError,
    });
    setExpandedInvitePanel(false);

    setToastVariant(json.emailSent ? "success" : "warning");
    if (json.emailSent) {
      setToast(
        resent
          ? `Invite re-sent to ${invitedEmail}.`
          : `Invite emailed to ${invitedEmail}.`
      );
    } else {
      setToast(
        json.emailError
          ? `Invite link ready for ${invitedEmail}, but email could not be sent: ${json.emailError}`
          : `Invite link ready for ${invitedEmail}. Copy the link to share manually.`
      );
    }
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    const invitedEmail = email.trim().toLowerCase();
    const invitedName = name.trim();
    const res = await fetch("/api/admin/platform-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: invitedName, email: invitedEmail, role }),
    });
    const json = await res.json();
    const link = json.inviteLink ?? json.inviteUrl ?? "";
    if (res.ok) {
      setName("");
      setEmail("");
      if (link) {
        setCanViewInviteLinks(true);
        const userId = json.user?.id ?? "";
        showInvitePanel(userId, invitedEmail, invitedName, json);
        if (json.user) {
          setUsers((prev) => [
            {
              ...json.user,
              invite: {
                status: "active" as const,
                inviteUrl: link,
                expiresAt: json.expiresAt,
              },
            },
            ...prev.filter((user) => user.id !== json.user.id),
          ]);
        }
      } else {
        setToastVariant("success");
        setToast(`Invite sent to ${invitedEmail}.`);
      }
      load();
    } else {
      setToastVariant("warning");
      setToast(json.message ?? "Invite failed.");
    }
  }

  async function copyLink(link: string, label = "Invite link copied to clipboard.") {
    await navigator.clipboard.writeText(link);
    setToastVariant("success");
    setToast(label);
  }

  async function getInviteLink(user: PlatformUserRow) {
    if (user.invite?.inviteUrl) {
      await copyLink(user.invite.inviteUrl);
      return;
    }

    setRowActionId(user.id);
    try {
      const res = await fetch("/api/admin/platform-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, getInviteLink: true }),
      });
      const json = await res.json();
      if (res.ok && (json.inviteLink || json.inviteUrl)) {
        const link = json.inviteLink ?? json.inviteUrl ?? "";
        setCanViewInviteLinks(true);
        applyInviteToUser(user.id, link, json.expiresAt);
        showInvitePanel(user.id, user.email, user.name, { ...json, emailSent: false });
        await copyLink(link);
        load();
      } else {
        setToastVariant("warning");
        setToast(json.message ?? "Could not get invite link.");
      }
    } finally {
      setRowActionId(null);
    }
  }

  async function regenerateInvite(user: PlatformUserRow) {
    setRowActionId(user.id);
    try {
      const res = await fetch("/api/admin/platform-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, resendInvite: true }),
      });
      const json = await res.json();
      if (res.ok && (json.inviteLink || json.inviteUrl)) {
        const link = json.inviteLink ?? json.inviteUrl ?? "";
        setCanViewInviteLinks(true);
        applyInviteToUser(user.id, link, json.expiresAt);
        showInvitePanel(user.id, user.email, user.name, json, true);
        load();
      } else {
        setToastVariant("warning");
        setToast(json.message ?? "Could not regenerate invite.");
      }
    } finally {
      setRowActionId(null);
    }
  }

  async function resendInvite(user: PlatformUserRow) {
    setRowActionId(user.id);
    try {
      const res = await fetch("/api/admin/platform-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, resendInvite: true }),
      });
      const json = await res.json();
      if (res.ok && (json.inviteLink || json.inviteUrl)) {
        const link = json.inviteLink ?? json.inviteUrl ?? "";
        setCanViewInviteLinks(true);
        applyInviteToUser(user.id, link, json.expiresAt);
        showInvitePanel(user.id, user.email, user.name, json, true);
      } else {
        setToastVariant("warning");
        setToast(json.message ?? "Could not resend invite.");
      }
    } finally {
      setRowActionId(null);
    }
  }

  async function updateRole(id: string, newRole: string) {
    await fetch("/api/admin/platform-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: newRole }),
    });
    load();
  }

  async function removeUser(id: string) {
    const res = await fetch(`/api/admin/platform-users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setToastVariant("warning");
      setToast(json.message ?? "Could not remove user.");
      return;
    }
    if (invitePanel?.userId === id) {
      setInvitePanel(null);
    }
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading users…</p>;
  }

  const emailConfigured = emailConfig?.configured ?? true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & roles"
        description="Invite team members by email. They receive a link automatically when email is configured, or you can copy the link anytime from pending users."
        breadcrumb="Users"
        actions={
          <Link href="/platform/users/activity" className="platform-btn-secondary">
            <Activity className="size-4" />
            Activity log
          </Link>
        }
      />

      {inviteSchemaWarning && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-red-950">
          <p className="text-sm font-semibold">Invite links need a database update</p>
          <p className="mt-1 text-sm text-red-900/90">
            Open Supabase → SQL Editor → paste and run{" "}
            <code className="rounded bg-red-500/20 px-1">026_platform_production_schema_fixes.sql</code>.
            Delete user and stored invite links will not work until this runs.
          </p>
          <p className="mt-2 font-mono text-xs text-red-900/80">{inviteSchemaWarning}</p>
        </div>
      )}

      {canViewInviteLinks && !inviteSchemaWarning && (
        <details className="platform-card rounded-xl px-4 py-3 text-sm text-[var(--platform-text-secondary)]">
          <summary className="cursor-pointer font-medium text-[var(--platform-text)]">
            After running migration 026 — quick checklist
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>Hard-refresh this page (Ctrl+Shift+R).</li>
            <li>Confirm the red database banner above is gone.</li>
            <li>For existing pending users, click <strong>Regenerate</strong> once to reveal stored links.</li>
            <li>New invites show the link immediately in the card at the top of this page.</li>
            <li>Test delete on a pending test user — it should succeed without schema errors.</li>
          </ol>
        </details>
      )}

      {!emailConfigured && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-amber-950">
          <p className="text-sm font-semibold">Automatic invite emails are not configured</p>
          <p className="mt-1 text-sm text-amber-900/90">
            Invites still work — use <strong>Copy invite link</strong> on each pending user. To
            email invites automatically, add{" "}
            {emailConfig?.missing.length ? (
              <code className="rounded bg-amber-500/20 px-1">{emailConfig.missing.join(", ")}</code>
            ) : (
              <>
                <code className="rounded bg-amber-500/20 px-1">RESEND_API_KEY</code> and{" "}
                <code className="rounded bg-amber-500/20 px-1">RESEND_FROM_EMAIL</code>
              </>
            )}{" "}
            in Vercel.
          </p>
          <div className="mt-3">
            <EmailSetupHelp />
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toastVariant === "success"
              ? "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800"
          }`}
        >
          {toast}
        </div>
      )}

      {invitePanel && (
        <div className="platform-card space-y-4 rounded-xl border border-[var(--platform-accent)]/20 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--platform-text)]">
                {invitePanel.emailSent
                  ? `Invite emailed to ${invitePanel.email}`
                  : `Invite link for ${invitePanel.email}`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
                {invitePanel.name} · pending · link valid 7 days
              </p>
              {!invitePanel.emailSent && (
                <p className="mt-2 text-xs text-amber-800">
                  {invitePanel.emailError ??
                    "Email was not sent. Copy the link below or configure Resend in Vercel."}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInvitePanel(null)}
              className="shrink-0 text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setExpandedInvitePanel((value) => !value)}
              className="min-w-0 flex-1 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-left font-mono text-xs text-[var(--platform-text)] hover:border-[var(--platform-accent)]/40 sm:py-2.5"
            >
              <span
                className={
                  expandedInvitePanel ? "break-all whitespace-pre-wrap" : "block truncate"
                }
              >
                {invitePanel.link}
              </span>
            </button>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyLink(invitePanel.link)}
                className="platform-btn-primary min-h-11"
              >
                <Copy className="size-4" />
                Copy link
              </button>
              <a
                href={invitePanel.link}
                target="_blank"
                rel="noopener noreferrer"
                className="platform-btn-secondary min-h-11"
              >
                <ExternalLink className="size-4" />
                Open link
              </a>
              <button
                type="button"
                onClick={() =>
                  resendInvite({
                    id: invitePanel.userId,
                    email: invitePanel.email,
                    name: invitePanel.name,
                  } as PlatformUserRow)
                }
                disabled={rowActionId === invitePanel.userId}
                className="platform-btn-secondary min-h-11"
              >
                <Mail className="size-4" />
                Resend email
              </button>
            </div>
          </div>

          {!emailConfigured && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3">
              <EmailSetupHelp compact />
            </div>
          )}
        </div>
      )}

      <form onSubmit={inviteUser} className="platform-card grid gap-4 rounded-xl p-5 sm:grid-cols-4">
        <label className="block space-y-1.5 sm:col-span-1">
          <span className="text-xs text-[var(--platform-text-secondary)]">Name</span>
          <input
            required
            className="platform-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-1">
          <span className="text-xs text-[var(--platform-text-secondary)]">Email</span>
          <input
            required
            type="email"
            className="platform-input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-1">
          <span className="text-xs text-[var(--platform-text-secondary)]">Role</span>
          <select
            className="platform-select w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r] ?? r}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end sm:col-span-1">
          <button type="submit" className="platform-btn-primary w-full">
            <UserPlus className="size-4" />
            Send invite
          </button>
        </div>
      </form>

      <div className="platform-card overflow-x-auto rounded-xl">
        <table className="platform-table w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canViewInviteLinks && (
                <th className="px-4 py-3 font-medium">Invite link</th>
              )}
              <th className="px-4 py-3 font-medium">Profile</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={canViewInviteLinks ? 8 : 7}
                  className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                >
                  No team members yet. Invite your first user above.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-[var(--platform-text-secondary)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="platform-select"
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      disabled={user.role === "owner"}
                    >
                      {user.role === "owner" ? (
                        <option value="owner">Owner</option>
                      ) : (
                        roles.map((r) => (
                          <option key={r} value={r}>
                            {roleLabels[r] ?? r}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">{statusBadge(user.status ?? "pending")}</td>
                  {canViewInviteLinks && (
                    <td className="px-4 py-3 align-top">
                      <InviteLinkCell
                        user={user}
                        rowActionId={rowActionId}
                        onCopyInvite={getInviteLink}
                        onRegenerateInvite={regenerateInvite}
                        onResendInvite={resendInvite}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <UserProfileCell user={user} />
                  </td>
                  <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                    <PlatformDateTime value={user.last_login_at} className="text-xs" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {canViewInviteLinks && user.status === "pending" && (
                        <button
                          type="button"
                          onClick={() =>
                            user.invite?.inviteUrl
                              ? getInviteLink(user)
                              : regenerateInvite(user)
                          }
                          disabled={rowActionId === user.id}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--platform-text-secondary)] hover:text-[var(--platform-accent)]"
                          aria-label={
                            user.invite?.inviteUrl ? "Copy invite link" : "Generate invite link"
                          }
                          title={
                            user.invite?.inviteUrl ? "Copy invite link" : "Generate invite link"
                          }
                        >
                          {user.invite?.inviteUrl ? (
                            <Copy className="size-4" />
                          ) : (
                            <RefreshCw
                              className={`size-4 ${rowActionId === user.id ? "animate-spin" : ""}`}
                            />
                          )}
                        </button>
                      )}
                      {user.role !== "owner" && (
                        <button
                          type="button"
                          onClick={() => removeUser(user.id)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                          aria-label="Delete user"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
