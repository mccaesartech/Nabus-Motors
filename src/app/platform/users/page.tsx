"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  Mail,
  RefreshCw,
  Trash2,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import {
  RESEND_DIAGNOSTICS_PATH,
} from "@/lib/email/resend-constants";
import { PLATFORM_INVITE_EXPIRY_LABEL } from "@/lib/platform/invite-ttl";
import { ownerInviteDeliveryError } from "@/lib/platform/invite-delivery-messages";
import { ROLE_LABELS } from "@/lib/platform/permissions";
import type { PlatformUserInviteInfo, PlatformUserNotifyInfo, PlatformUserRow } from "@/lib/platform/modules";
import { formatPlatformDate } from "@/lib/platform/datetime";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type RoleLabels = Record<string, string>;

type EmailConfig = {
  configured: boolean;
  hasApiKey: boolean;
  hasFromAddress: boolean;
  missing: string[];
};

type SmsConfig = {
  ready: boolean;
  preferred: boolean;
  configured: boolean;
};

type InvitePanel = {
  userId: string;
  email: string;
  name: string;
  link: string;
  emailSent: boolean;
  emailHint?: string;
  notify?: PlatformUserNotifyInfo;
};

function notifyBadge(notify?: PlatformUserNotifyInfo | null) {
  if (!notify) return null;
  const styles: Record<string, string> = {
    sent: "bg-emerald-500/10 text-emerald-700",
    skipped_no_phone: "bg-amber-500/10 text-amber-800",
    skipped_not_configured: "bg-slate-500/10 text-slate-600",
    failed: "bg-red-500/10 text-red-700",
    pending: "bg-amber-500/10 text-amber-700",
  };
  return (
    <span
      className={`mt-1 inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[notify.status] ?? styles.pending}`}
      title={notify.label}
    >
      {notify.label}
    </span>
  );
}

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

function inviteEmailStatusLabel(invite: PlatformUserInviteInfo): string | null {
  if (invite.emailStatus === "FAILED") return "Email failed";
  if (invite.emailStatus === "SENT") return "Email sent";
  if (invite.emailStatus === "PENDING") return "Email pending";
  return null;
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
      {inviteEmailStatusLabel(invite) && (
        <p
          className={`text-xs ${
            invite.emailStatus === "FAILED"
              ? "text-red-700"
              : invite.emailStatus === "SENT"
                ? "text-emerald-700"
                : "text-amber-800"
          }`}
        >
          {inviteEmailStatusLabel(invite)}
          {invite.emailStatus === "FAILED"
            ? " — use Resend or copy the link below"
            : null}
        </p>
      )}

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
          , add <code>truegoshengh.com</code> under <strong>Domains</strong>, and copy the
          DKIM and SPF records it shows into your DNS. Wait until the domain reads{" "}
          <strong>Verified</strong> — until then Resend only delivers to the account
          owner&apos;s own inbox.
        </li>
        <li>
          Create the API key <em>while signed into the same Resend team that lists the
          verified domain</em>. A key from another account or team makes Resend answer
          &ldquo;the truegoshengh.com domain is not verified&rdquo; even though your
          dashboard shows it Verified.
        </li>
        <li>
          In your Vercel project, open <strong>Settings → Environment Variables</strong> and add:
          <ul className="mt-1.5 list-disc space-y-1 pl-4 font-mono text-xs">
            <li>
              <code>RESEND_API_KEY</code> — API key from Resend dashboard
            </li>
            <li>
              <code>RESEND_FROM_EMAIL</code> —{" "}
              <code>noreply@truegoshengh.com</code>
            </li>
          </ul>
          <p className="mt-1.5">
            Tick <strong>Production</strong> on both. Vercel stores a separate value per
            environment, so a key saved only to Preview leaves production sending with
            the old one.
          </p>
        </li>
        <li>Redeploy the site (or run a new production deploy) so the variables take effect.</li>
        <li>
          Open{" "}
          <a href={RESEND_DIAGNOSTICS_PATH} className="font-medium underline">
            <code>{RESEND_DIAGNOSTICS_PATH}</code>
          </a>{" "}
          while signed in. It reports the domains the deployed key can actually see, the
          key&apos;s last four characters, and which environment answered. Proceed only
          once <code>status</code> reads <code>ok</code>.
        </li>
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
  const [smsConfig, setSmsConfig] = useState<SmsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("manager");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [passwordPanel, setPasswordPanel] = useState<{
    userId: string;
    email: string;
    name: string;
  } | null>(null);
  const [panelPassword, setPanelPassword] = useState("");
  const [panelConfirm, setPanelConfirm] = useState("");
  const [panelError, setPanelError] = useState("");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "warning" | "error">("success");
  const [invitePanel, setInvitePanel] = useState<InvitePanel | null>(null);
  const [expandedInvitePanel, setExpandedInvitePanel] = useState(false);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [canViewInviteLinks, setCanViewInviteLinks] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformUserRow | null>(null);

  function ownerCanViewInviteLinks(
    usersPayload: { canViewInviteLinks?: boolean },
    sessionPayload: { ok?: boolean; user?: { type?: string; role?: string } }
  ) {
    if (usersPayload.canViewInviteLinks) return true;
    const user = sessionPayload.user;
    return Boolean(sessionPayload.ok && (user?.type === "owner" || user?.role === "owner" || user?.role === "super_admin"));
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
    setUsers((prev) => {
      const next = (json.users ?? []) as PlatformUserRow[];
      // Preserve per-row notify status from this browser session across reloads.
      const notifyById = new Map(
        prev.filter((u) => u.notify).map((u) => [u.id, u.notify!] as const)
      );
      return next.map((user) =>
        notifyById.has(user.id) ? { ...user, notify: notifyById.get(user.id) } : user
      );
    });
    setRoles(json.roles ?? []);
    setRoleLabels(json.roleLabels ?? ROLE_LABELS);
    setEmailConfig(json.emailConfig ?? null);
    setSmsConfig(json.smsConfig ?? null);
    const ownerViewer = ownerCanViewInviteLinks(json, sessionJson);
    setCanViewInviteLinks(ownerViewer);
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

  useEffect(() => {
    if (passwordPanel && !users.some((user) => user.id === passwordPanel.userId)) {
      setPasswordPanel(null);
    }
  }, [users, passwordPanel]);

  function showInvitePanel(
    userId: string,
    invitedEmail: string,
    invitedName: string,
    json: {
      inviteLink?: string;
      inviteUrl?: string;
      emailSent?: boolean;
      emailError?: string;
      emailHint?: string;
      notify?: PlatformUserNotifyInfo;
    },
    resent = false
  ) {
    const link = json.inviteLink ?? json.inviteUrl ?? "";
    if (!link) return;

    const emailSent = Boolean(json.emailSent);
    const notifyFailed = json.notify?.status === "failed";
    const emailHint = json.emailHint?.trim() || undefined;

    setInvitePanel({
      userId,
      email: invitedEmail,
      name: invitedName,
      link,
      emailSent,
      emailHint,
      notify: json.notify,
    });
    setExpandedInvitePanel(false);

    const smsSkipped = json.notify?.status === "skipped_no_phone";
    const smsNotConfigured = json.notify?.status === "skipped_not_configured";
    const deliveryError = ownerInviteDeliveryError({
      emailSent,
      notifyFailed,
      emailHint,
    });

    if (deliveryError) {
      setToastVariant("error");
    } else if (smsSkipped || smsNotConfigured) {
      setToastVariant("warning");
    } else {
      setToastVariant("success");
    }

    const parts: string[] = [];
    if (emailSent) {
      parts.push(
        resent
          ? `Invite re-sent to ${invitedEmail}`
          : `Invite emailed to ${invitedEmail}`
      );
    } else {
      parts.push(`Invite link ready for ${invitedEmail}`);
    }
    if (deliveryError) {
      parts.push(deliveryError);
    } else if (smsSkipped) {
      parts.push("SMS skipped (no phone)");
    } else if (smsNotConfigured) {
      parts.push("SMS not configured");
    } else if (json.notify?.status === "sent") {
      parts.push(json.notify.label);
    }
    setToast(`${parts.join(". ")}.`);
  }

  /** Toast when the API created an invite but did not return a copyable link. */
  function toastInviteWithoutLink(
    invitedEmail: string,
    json: {
      emailSent?: boolean;
      emailHint?: string;
      notify?: PlatformUserNotifyInfo;
    }
  ) {
    const emailSent = Boolean(json.emailSent);
    const notifyFailed = json.notify?.status === "failed";
    const smsSkipped = json.notify?.status === "skipped_no_phone";
    const smsNotConfigured = json.notify?.status === "skipped_not_configured";
    const deliveryError = ownerInviteDeliveryError({
      emailSent,
      notifyFailed,
      emailHint: json.emailHint,
    });

    if (deliveryError) {
      setToastVariant("error");
    } else if (smsSkipped || smsNotConfigured) {
      setToastVariant("warning");
    } else {
      setToastVariant("success");
    }

    const parts: string[] = [];
    if (emailSent) {
      parts.push(`Invite emailed to ${invitedEmail}`);
    } else {
      parts.push(`Invite created for ${invitedEmail}`);
    }
    if (deliveryError) {
      parts.push(deliveryError);
    } else if (smsSkipped) {
      parts.push("SMS skipped (no phone)");
    } else if (smsNotConfigured) {
      parts.push("SMS not configured");
    } else if (json.notify?.label) {
      parts.push(json.notify.label);
    }
    setToast(`${parts.join(". ")}.`);
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    setNewPasswordError("");

    if (smsConfig?.preferred && !phone.trim()) {
      setNewPasswordError("Phone number is required when SMS invites are enabled.");
      setToastVariant("warning");
      setToast("Add a phone number so the invite SMS can be sent.");
      return;
    }

    if (newPassword || newPasswordConfirm) {
      if (newPassword.length < 8) {
        setNewPasswordError("Password must be at least 8 characters.");
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setNewPasswordError("Passwords do not match.");
        return;
      }
    }

    const invitedEmail = email.trim().toLowerCase();
    const invitedName = name.trim();
    const invitedPhone = phone.trim();
    const res = await fetch("/api/admin/platform-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: invitedName,
        email: invitedEmail,
        role,
        ...(invitedPhone ? { phone: invitedPhone } : {}),
        ...(newPassword
          ? { password: newPassword, confirmPassword: newPasswordConfirm }
          : {}),
      }),
    });
    const json = await res.json();
    const link = json.inviteLink ?? json.inviteUrl ?? "";
    if (res.ok) {
      setName("");
      setEmail("");
      setPhone("");
      setNewPassword("");
      setNewPasswordConfirm("");
      if (json.passwordSet) {
        const notifyLabel = json.notify?.label as string | undefined;
        const deliveryError = ownerInviteDeliveryError({
          emailSent: Boolean(json.emailSent),
          notifyFailed: json.notify?.status === "failed",
          emailHint: typeof json.emailHint === "string" ? json.emailHint : null,
        });
        if (link) {
          setCanViewInviteLinks(true);
          const userId = json.user?.id ?? "";
          showInvitePanel(userId, invitedEmail, invitedName, json);
          if (json.user) {
            setUsers((prev) => [
              {
                ...json.user,
                notify: json.notify,
                invite: {
                  status: "active" as const,
                  inviteUrl: link,
                  expiresAt: json.expiresAt,
                  emailStatus: json.emailSent ? ("SENT" as const) : ("FAILED" as const),
                },
              },
              ...prev.filter((user) => user.id !== json.user.id),
            ]);
          }
          load();
          return;
        }
        setToastVariant(deliveryError ? "error" : json.notify?.status === "skipped_no_phone" ? "warning" : "success");
        if (deliveryError) {
          setToast(
            `${invitedEmail} created with a password, but delivery failed. ${deliveryError}`
          );
        } else {
          setToast(
            notifyLabel
              ? `${invitedEmail} created with a password. Temporary password included in email/SMS. ${notifyLabel}.`
              : `${invitedEmail} created with a password. Temporary password included in email/SMS with their invite link.`
          );
        }
        if (json.user) {
          setUsers((prev) => [
            { ...json.user, notify: json.notify },
            ...prev.filter((user) => user.id !== json.user.id),
          ]);
        }
        load();
        return;
      }
      if (link) {
        setCanViewInviteLinks(true);
        const userId = json.user?.id ?? "";
        showInvitePanel(userId, invitedEmail, invitedName, json);
        if (json.user) {
          setUsers((prev) => [
            {
              ...json.user,
              notify: json.notify,
              invite: {
                status: "active" as const,
                inviteUrl: link,
                expiresAt: json.expiresAt,
                emailStatus: json.emailSent ? ("SENT" as const) : ("FAILED" as const),
              },
            },
            ...prev.filter((user) => user.id !== json.user.id),
          ]);
        }
      } else {
        toastInviteWithoutLink(invitedEmail, json);
        if (json.user) {
          setUsers((prev) => [
            {
              ...json.user,
              notify: json.notify,
              invite: {
                status: "active" as const,
                expiresAt: json.expiresAt,
                emailStatus: json.emailSent ? ("SENT" as const) : ("FAILED" as const),
              },
            },
            ...prev.filter((user) => user.id !== json.user.id),
          ]);
        }
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
        if (json.notify) {
          setUsers((prev) =>
            prev.map((row) =>
              row.id === user.id ? { ...row, notify: json.notify } : row
            )
          );
        }
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
        if (json.notify) {
          setUsers((prev) =>
            prev.map((row) =>
              row.id === user.id ? { ...row, notify: json.notify } : row
            )
          );
        }
        showInvitePanel(user.id, user.email, user.name, json, true);
      } else {
        setToastVariant("warning");
        setToast(json.message ?? "Could not resend invite.");
      }
    } finally {
      setRowActionId(null);
    }
  }

  function openPasswordPanel(user: PlatformUserRow) {
    setPasswordPanel({ userId: user.id, email: user.email, name: user.name });
    setPanelPassword("");
    setPanelConfirm("");
    setPanelError("");
  }

  async function submitSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordPanel) return;

    setPanelError("");
    if (panelPassword.length < 8) {
      setPanelError("Password must be at least 8 characters.");
      return;
    }
    if (panelPassword !== panelConfirm) {
      setPanelError("Passwords do not match.");
      return;
    }

    setRowActionId(passwordPanel.userId);
    try {
      const res = await fetch("/api/admin/platform-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: passwordPanel.userId,
          password: panelPassword,
          confirmPassword: panelConfirm,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPanelError(json.message ?? "Could not set password.");
        return;
      }
      setToastVariant(
        json.emailSent === false || json.notify?.status === "failed" ? "warning" : "success"
      );
      const deliveryError = ownerInviteDeliveryError({
        emailSent: json.emailSent !== false,
        notifyFailed: json.notify?.status === "failed",
        emailHint: typeof json.emailHint === "string" ? json.emailHint : null,
      });
      setToast(
        deliveryError
          ? `Password set for ${passwordPanel.email}, but delivery failed. ${deliveryError}`
          : `Password set for ${passwordPanel.email}. Temporary password included in email/SMS so they can sign in.`
      );
      setPasswordPanel(null);
      setPanelPassword("");
      setPanelConfirm("");
      load();
    } finally {
      setRowActionId(null);
    }
  }

  async function updateRole(id: string, newRole: string) {
    const previous = users.find((user) => user.id === id);
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, role: newRole } : user))
    );
    setRowActionId(id);
    try {
      const res = await fetch("/api/admin/platform-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: newRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (previous) {
          setUsers((prev) =>
            prev.map((user) => (user.id === id ? { ...user, role: previous.role } : user))
          );
        }
        setToastVariant("warning");
        setToast(json.message ?? "Could not update role.");
        return;
      }
      const roleName = roleLabels[newRole] ?? newRole;
      const notify = json.notify as PlatformUserNotifyInfo | undefined;
      if (notify) {
        setUsers((prev) =>
          prev.map((user) => (user.id === id ? { ...user, role: newRole, notify } : user))
        );
      }
      setToastVariant(
        notify?.status === "skipped_no_phone" || notify?.status === "failed"
          ? "warning"
          : "success"
      );
      setToast(
        notify?.label
          ? `Role updated to ${roleName}. ${notify.label}.`
          : `Role updated to ${roleName}.`
      );
    } finally {
      setRowActionId(null);
    }
  }

  async function toggleUserStatus(user: PlatformUserRow) {
    if (user.role === "owner") return;
    const nextStatus = user.status === "disabled" ? "active" : "disabled";
    const label = nextStatus === "disabled" ? "disable" : "re-enable";
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${user.email}?`)) return;

    setRowActionId(user.id);
    try {
      const res = await fetch("/api/admin/platform-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToastVariant("warning");
        setToast(json.message ?? `Could not ${label} user.`);
      } else {
        load();
      }
    } finally {
      setRowActionId(null);
    }
  }

  async function removeUser(user: PlatformUserRow) {
    setRowActionId(user.id);
    setToastVariant("success");
    setToast("Moving user to trash…");
    try {
      const res = await fetch(`/api/admin/platform-users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToastVariant("warning");
        setToast(json.message ?? "Could not move user to trash.");
        return;
      }
      if (invitePanel?.userId === user.id) {
        setInvitePanel(null);
      }
      setToastVariant("success");
      setToast(
        json.message ??
          `${user.email} moved to trash. Restore from Platform → Trash if needed.`
      );
      load();
    } finally {
      setRowActionId(null);
      setDeleteTarget(null);
    }
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
              : toastVariant === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-700"
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
                {invitePanel.name} · pending · link valid {PLATFORM_INVITE_EXPIRY_LABEL}
              </p>
              {invitePanel.notify?.status === "sent" && (
                <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                  Notification: {invitePanel.notify.label}
                </p>
              )}
              {(() => {
                const deliveryError = ownerInviteDeliveryError({
                  emailSent: invitePanel.emailSent,
                  notifyFailed: invitePanel.notify?.status === "failed",
                  emailHint: invitePanel.emailHint,
                });
                return deliveryError ? (
                  <p className="mt-2 text-sm text-red-700">{deliveryError}</p>
                ) : null;
              })()}
              {!invitePanel.emailSent &&
                invitePanel.notify?.status !== "failed" && (
                  <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">
                    Copy or open the link below to share the invite manually.
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
        </div>
      )}

      {passwordPanel && (
        <form
          onSubmit={submitSetPassword}
          className="platform-card space-y-4 rounded-xl border border-[var(--platform-accent)]/20 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--platform-text)]">
                Set password for {passwordPanel.email}
              </p>
              <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
                {passwordPanel.name} · this temporary password will be included in the email and
                SMS with the sign-in link. Enter it twice to confirm.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPasswordPanel(null)}
              className="shrink-0 text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">New password</span>
              <PasswordInput
                required
                minLength={8}
                autoComplete="new-password"
                className="platform-input w-full"
                value={panelPassword}
                onChange={(e) => setPanelPassword(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">
                Confirm password
              </span>
              <PasswordInput
                required
                minLength={8}
                autoComplete="new-password"
                className="platform-input w-full"
                value={panelConfirm}
                onChange={(e) => setPanelConfirm(e.target.value)}
              />
            </label>
          </div>

          {panelError && <p className="text-sm text-red-600">{panelError}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={rowActionId === passwordPanel.userId}
              className="platform-btn-primary min-h-11"
            >
              <KeyRound className="size-4" />
              {rowActionId === passwordPanel.userId ? "Saving…" : "Set password"}
            </button>
            <button
              type="button"
              onClick={() => setPasswordPanel(null)}
              className="platform-btn-secondary min-h-11"
            >
              Cancel
            </button>
          </div>
        </form>
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
          <span className="text-xs text-[var(--platform-text-secondary)]">
            Phone{smsConfig?.preferred ? " (required for SMS)" : " (optional)"}
          </span>
          <input
            type="tel"
            required={Boolean(smsConfig?.preferred)}
            className="platform-input w-full"
            placeholder="0244…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
        <div className="flex items-end sm:col-span-4">
          <button type="submit" className="platform-btn-primary w-full sm:w-auto">
            <UserPlus className="size-4" />
            {newPassword ? "Create user" : "Send invite"}
          </button>
        </div>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs text-[var(--platform-text-secondary)]">
            Password (optional)
          </span>
          <PasswordInput
            autoComplete="new-password"
            minLength={8}
            className="platform-input w-full"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <span className="block text-[11px] text-[var(--platform-text-secondary)]">
            {newPassword
              ? "Temporary password will be included in the email and SMS with the sign-in link."
              : "Leave blank to send an invite link so they set their own password."}
          </span>
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs text-[var(--platform-text-secondary)]">
            Confirm password
          </span>
          <PasswordInput
            autoComplete="new-password"
            minLength={8}
            required={Boolean(newPassword)}
            className="platform-input w-full"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
          />
        </label>
        {newPasswordError && (
          <p className="text-sm text-red-600 sm:col-span-4">{newPasswordError}</p>
        )}
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
                    <div className="space-y-1">
                      <select
                        className="platform-select"
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        disabled={user.role === "owner" || rowActionId === user.id}
                      >
                        {user.role === "owner" ? (
                          <option value="owner">{roleLabels.owner ?? "Owner"}</option>
                        ) : (
                          <>
                            {/* Keep current legacy IAM role visible until reassigned */}
                            {!roles.includes(user.role) && (
                              <option value={user.role}>
                                {roleLabels[user.role] ?? user.role} (legacy)
                              </option>
                            )}
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {roleLabels[r] ?? r}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      <div className="text-[10px] text-[var(--platform-text-secondary)]">
                        {roleLabels[user.role] ?? user.role}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {statusBadge(user.status ?? "pending")}
                      {notifyBadge(user.notify)}
                    </div>
                  </td>
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
                      <button
                        type="button"
                        onClick={() => openPasswordPanel(user)}
                        disabled={rowActionId === user.id}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--platform-text-secondary)] hover:text-[var(--platform-accent)]"
                        aria-label="Set password"
                        title="Set password"
                      >
                        <KeyRound className="size-4" />
                      </button>
                      {user.role !== "owner" && user.status !== "pending" && (
                        <button
                          type="button"
                          onClick={() => void toggleUserStatus(user)}
                          disabled={rowActionId === user.id}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--platform-text-secondary)] hover:text-amber-700"
                          aria-label={user.status === "disabled" ? "Re-enable user" : "Disable user"}
                          title={user.status === "disabled" ? "Re-enable user" : "Disable user"}
                        >
                          <UserX className="size-4" />
                        </button>
                      )}
                      {user.role !== "owner" && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          disabled={rowActionId === user.id}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                          aria-label="Move user to trash"
                          title="Move to trash"
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Move user to trash?"
        description={
          deleteTarget
            ? `Move ${deleteTarget.name} (${deleteTarget.email}) to trash? They will lose platform access until restored from Platform → Trash.`
            : ""
        }
        confirmLabel="Move to trash"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await removeUser(deleteTarget);
        }}
      />
    </div>
  );
}
