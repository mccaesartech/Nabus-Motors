import { NextRequest, NextResponse } from "next/server";
import { canViewInviteLinks, requirePermission } from "@/lib/admin/auth";
import { apiFailure, dbFailure } from "@/lib/errors/api";
import { mapDatabaseError } from "@/lib/errors/db-errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { INVITABLE_ROLES, ROLE_LABELS, normalizeRole } from "@/lib/platform/permissions";
import { generateToken, hashPassword, hashToken } from "@/lib/platform/password";
import { buildPlatformInviteUrl } from "@/lib/platform/invite-url";
import { logPlatformActivity } from "@/lib/platform/activity";
import { sendPlatformInviteEmail, getPlatformEmailConfig } from "@/lib/email/platform-invite";
import { validateEmailForSignup } from "@/lib/email/validate-email-server";
import type { PlatformUserInviteInfo } from "@/lib/platform/modules";
import {
  computePlatformInviteExpiresAt,
  isPlatformInviteExpired,
} from "@/lib/platform/invite-ttl";
import {
  notifyTeamInviteWhatsApp,
  notifyTeamPasswordSetWhatsApp,
  notifyTeamRoleChangedWhatsApp,
  formatTeamNotifyLabel,
  type TeamNotifyResult,
} from "@/lib/notifications/platform-team-whatsapp";
import { getArkeselConfig, shouldPreferArkeselSms } from "@/lib/notifications/arkesel-config";
import {
  notDeletedFilter,
  recordTrashEntry,
  softDeleteEntity,
} from "@/lib/platform/trash";
import { assertPlatformUserDeletable } from "@/lib/platform/platform-user-delete";
import {
  isMissingColumnError,
  reportSchemaIssue,
} from "@/lib/observability/schema-issue";

export const dynamic = "force-dynamic";

function isMissingDeletedAtError(message: string | undefined): boolean {
  return isMissingColumnError(message, "deleted_at");
}

function reportPlatformUsersDeletedAtIssue(message: string, source: string) {
  reportSchemaIssue({
    table: "platform_users",
    column: "deleted_at",
    migration: "078_platform_user_soft_delete.sql",
    source,
    message,
  });
}

/** Owner-safe error messages — schema/ops details go to Sentry, not the UI. */
function withSchemaMigrationHint(message: string): string {
  if (isMissingDeletedAtError(message)) {
    reportPlatformUsersDeletedAtIssue(message, "platform-users-api");
    return "Could not complete that action. Please try again.";
  }
  if (/sender_anonymized|token_plain|schema cache/i.test(message)) {
    reportSchemaIssue({
      table: "platform_user_invites",
      migration: "026_platform_production_schema_fixes.sql",
      source: "platform-users-api",
      message,
    });
    return "Could not complete that action. Please try again.";
  }
  // Never echo the raw Postgres text — map it, or fall back to a safe sentence.
  return mapDatabaseError({ message }, "Could not complete that action. Please try again.").message;
}

function notifyPayload(result: TeamNotifyResult) {
  return {
    notify: {
      channel: result.channel,
      status: result.status,
      label: formatTeamNotifyLabel(result),
      detail: result.detail,
    },
  };
}

async function listTrashedPlatformUserIds(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("platform_trash")
    .select("entity_id")
    .eq("entity_type", "platform_user")
    .is("restored_at", null)
    .is("permanently_deleted_at", null);

  if (error) {
    console.error("[platform_user trash] list failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.entity_id)));
}

async function listActivePlatformUsers(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>
) {
  const filtered = await notDeletedFilter(supabase.from("platform_users").select("*")).order(
    "created_at",
    { ascending: false }
  );

  if (!filtered.error) {
    return {
      users: filtered.data ?? [],
      error: null as { message: string } | null,
    };
  }

  if (isMissingDeletedAtError(filtered.error.message)) {
    reportPlatformUsersDeletedAtIssue(
      filtered.error.message,
      "platform-users.listActivePlatformUsers"
    );
    const [fallback, trashedIds] = await Promise.all([
      supabase.from("platform_users").select("*").order("created_at", { ascending: false }),
      listTrashedPlatformUserIds(supabase),
    ]);
    const users = (fallback.data ?? []).filter((row) => !trashedIds.has(String(row.id)));
    return {
      users,
      error: fallback.error,
    };
  }

  return {
    users: filtered.data ?? [],
    error: filtered.error,
  };
}

async function refreshInviteForUser(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string
) {
  await supabase.from("platform_user_invites").delete().eq("user_id", userId).is("accepted_at", null);

  const plainToken = generateToken();
  const tokenHash = await hashToken(plainToken);
  const expiresAt = computePlatformInviteExpiresAt();

  const { error } = await supabase.from("platform_user_invites").insert({
    user_id: userId,
    token_hash: tokenHash,
    token_plain: plainToken,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { link: buildPlatformInviteUrl(plainToken), expiresAt };
}

type InviteRecord = {
  user_id: string;
  expires_at: string;
  accepted_at: string | null;
  token_plain: string | null;
  created_at: string;
};

function buildInviteInfo(invite: InviteRecord | undefined): PlatformUserInviteInfo {
  if (!invite) return { status: "none" };

  if (invite.accepted_at) {
    return {
      status: "accepted",
      acceptedAt: invite.accepted_at,
    };
  }

  const expired = isPlatformInviteExpired(invite.expires_at);
  if (expired) {
    return { status: "expired", expiresAt: invite.expires_at };
  }

  if (invite.token_plain) {
    return {
      status: "active",
      inviteUrl: buildPlatformInviteUrl(invite.token_plain),
      expiresAt: invite.expires_at,
    };
  }

  return {
    status: "active",
    expiresAt: invite.expires_at,
    needsRegenerate: true,
  };
}

async function getOrRefreshInviteForUser(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string,
  forceRefresh = false
) {
  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from("platform_user_invites")
      .select("token_plain, expires_at, accepted_at")
      .eq("user_id", userId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.token_plain) {
      return {
        link: buildPlatformInviteUrl(existing.token_plain),
        expiresAt: existing.expires_at,
      };
    }
  }

  return refreshInviteForUser(supabase, userId);
}

function ownerInvitePayload(link: string, expiresAt: string) {
  return { inviteLink: link, inviteUrl: link, expiresAt };
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("users");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const emailConfig = getPlatformEmailConfig();
  const inviteLinkFor = req.nextUrl.searchParams.get("inviteLinkFor");
  const isOwner = canViewInviteLinks(auth.auth);
  const [arkeselConfig, preferSms] = await Promise.all([
    getArkeselConfig(),
    shouldPreferArkeselSms(),
  ]);
  const smsConfig = {
    ready: arkeselConfig.smsReady,
    preferred: preferSms,
    configured: arkeselConfig.configured,
  };

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      users: [],
      pendingInvites: [],
      roles: INVITABLE_ROLES,
      roleLabels: ROLE_LABELS,
      emailConfigured: emailConfig.configured,
      emailConfig,
      smsConfig,
      canViewInviteLinks: isOwner,
    });
  }

  if (inviteLinkFor) {
    if (!isOwner) {
      return NextResponse.json({ ok: false, message: "Only the owner can access invite links." }, { status: 403 });
    }

    const { data: user } = await supabase
      .from("platform_users")
      .select("id, name, email, role, status")
      .eq("id", inviteLinkFor)
      .maybeSingle();

    if (!user || user.status === "active") {
      return NextResponse.json({ ok: false, message: "No pending invite for this user." }, { status: 400 });
    }

    try {
      const { link, expiresAt } = await getOrRefreshInviteForUser(supabase, user.id);
      return NextResponse.json({
        ok: true,
        ...ownerInvitePayload(link, expiresAt),
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      return apiFailure(error, {
        module: "api.admin.platform-users.GET.inviteLink",
        message: "Could not generate invite link. Try again.",
        request: req,
        actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
      });
    }
  }

  const [usersResult, invitesResult] = await Promise.all([
    listActivePlatformUsers(supabase),
    isOwner
      ? supabase
          .from("platform_user_invites")
          .select("id, user_id, expires_at, accepted_at, created_at, token_plain")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const { users } = usersResult;
  const usersError = usersResult.error;
  const invites = invitesResult.data;
  const invitesError = invitesResult.error;

  if (usersError) {
    console.error("platform_users fetch failed:", usersError.message);
  }
  if (invitesError) {
    console.error("platform_user_invites fetch failed:", invitesError.message);
    reportSchemaIssue({
      table: "platform_user_invites",
      migration: "026_platform_production_schema_fixes.sql",
      source: "platform-users.GET",
      message: invitesError.message,
    });
  }

  const inviteByUser = new Map<string, InviteRecord>();
  if (isOwner) {
    for (const invite of (invites ?? []) as InviteRecord[]) {
      if (!inviteByUser.has(invite.user_id)) {
        inviteByUser.set(invite.user_id, invite);
      }
    }
  }

  const safeUsers = (users ?? []).map((user) => {
    const row = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      status: user.status ?? "pending",
      phone: user.phone ?? null,
      job_title: user.job_title ?? null,
      created_at: user.created_at,
      invited_at: user.invited_at ?? null,
      activated_at: user.activated_at ?? null,
      last_login_at: user.last_login_at ?? null,
    };

    if (isOwner) {
      return { ...row, invite: buildInviteInfo(inviteByUser.get(user.id)) };
    }

    return row;
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    users: safeUsers,
    pendingInvites: isOwner
      ? (invites ?? []).filter(
          (invite) =>
            !invite.accepted_at && !isPlatformInviteExpired(invite.expires_at)
        )
      : [],
    roles: INVITABLE_ROLES,
    roleLabels: ROLE_LABELS,
    emailConfigured: emailConfig.configured,
    emailConfig,
    smsConfig,
    canViewInviteLinks: isOwner,
    ...(usersError ? { usersError: usersError.message } : {}),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("users");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const emailRaw = String(body.email ?? "").trim().toLowerCase();
  const role = normalizeRole(String(body.role ?? "staff"));
  const phone = body.phone ? String(body.phone).trim() : null;
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!name || !emailRaw) {
    return NextResponse.json({ ok: false, message: "Name and email required" }, { status: 400 });
  }

  const emailCheck = await validateEmailForSignup(emailRaw);
  if (!emailCheck.ok || !emailCheck.normalized) {
    return NextResponse.json(
      { ok: false, message: emailCheck.message },
      { status: 400 }
    );
  }
  const email = emailCheck.normalized;

  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, message: "Invalid role for invitation" }, { status: 400 });
  }

  const preferSms = await shouldPreferArkeselSms();
  if (preferSms && !phone) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Phone number is required when SMS invites are enabled. Add a Ghana mobile number so the invite SMS can be sent.",
      },
      { status: 400 }
    );
  }

  if (password) {
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, message: "Passwords do not match." }, { status: 400 });
    }
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  const now = new Date().toISOString();

  // With a password the account is active immediately — no invite link needed.
  if (password) {
    const passwordHash = await hashPassword(password);
    const { data: user, error: userError } = await supabase
      .from("platform_users")
      .insert({
        name,
        email,
        role,
        phone,
        status: "active",
        invited_at: now,
        activated_at: now,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (userError) {
      const duplicate = userError.message.toLowerCase().includes("duplicate");
      return NextResponse.json(
        {
          ok: false,
          message: duplicate
            ? "A user with this email already exists."
            : withSchemaMigrationHint(userError.message),
        },
        { status: duplicate ? 409 : 500 }
      );
    }

    await logPlatformActivity(auth.auth, "user_password_set", email, {
      user_id: user.id,
      role,
      created_with_password: true,
    });
    const notify = await notifyTeamPasswordSetWhatsApp({
      phone: user.phone ?? phone,
      name: user.name ?? name,
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      passwordSet: true,
      user: { ...user, password_hash: undefined, role, status: "active" },
      emailSent: false,
      emailConfigured: getPlatformEmailConfig().configured,
      ...notifyPayload(notify),
    });
  }

  const { data: user, error: userError } = await supabase
    .from("platform_users")
    .insert({
      name,
      email,
      role,
      phone,
      status: "pending",
      invited_at: now,
    })
    .select()
    .single();

  if (userError) {
    const duplicate = userError.message.toLowerCase().includes("duplicate");
    return NextResponse.json(
      {
        ok: false,
        message: duplicate
          ? "A user with this email already exists."
          : withSchemaMigrationHint(userError.message),
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  const plainToken = generateToken();
  const tokenHash = await hashToken(plainToken);
  const expiresAt = computePlatformInviteExpiresAt();

  const { error: inviteError } = await supabase.from("platform_user_invites").insert({
    user_id: user.id,
    token_hash: tokenHash,
    token_plain: plainToken,
    expires_at: expiresAt,
  });

  if (inviteError) {
    await supabase.from("platform_users").delete().eq("id", user.id);
    return NextResponse.json(
      { ok: false, message: withSchemaMigrationHint(inviteError.message) },
      { status: 500 }
    );
  }

  const link = buildPlatformInviteUrl(plainToken);
  const emailResult = await sendPlatformInviteEmail({
    to: email,
    name,
    role,
    inviteUrl: link,
  });
  await logPlatformActivity(auth.auth, "invite_sent", email, {
    role,
    user_id: user.id,
    email_sent: emailResult.emailSent,
    ...(emailResult.emailSent ? {} : { email_error: emailResult.emailError }),
  });
  const notify = await notifyTeamInviteWhatsApp({
    phone: user.phone ?? phone,
    name,
    role,
    inviteUrl: link,
    userId: user.id,
  });

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      role,
      status: "pending",
      notify: notifyPayload(notify).notify,
    },
    ...(canViewInviteLinks(auth.auth) ? ownerInvitePayload(link, expiresAt) : {}),
    emailSent: emailResult.emailSent,
    emailConfigured: getPlatformEmailConfig().configured,
    ...(emailResult.emailSent ? {} : { emailError: emailResult.emailError }),
    ...notifyPayload(notify),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("users");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json();
  const id = String(body.id ?? "");
  const role = body.role ? normalizeRole(String(body.role)) : undefined;
  const name = body.name ? String(body.name).trim() : undefined;
  const status = body.status ? String(body.status).trim() : undefined;
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const resendInvite = Boolean(body.resendInvite);
  const getInviteLink = Boolean(body.getInviteLink);

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  if (password) {
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, message: "Passwords do not match." }, { status: 400 });
    }
  }

  if (role && !INVITABLE_ROLES.includes(role) && role !== "owner" && role !== "super_admin") {
    return NextResponse.json({ ok: false, message: "Invalid role" }, { status: 400 });
  }

  if (status && !["active", "disabled", "pending"].includes(status)) {
    return NextResponse.json({ ok: false, message: "Invalid status" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  // Privilege-escalation guard: only an owner may grant the owner role or
  // modify an existing owner account. `users` permission is held by both owner
  // and super_admin, so without this a super_admin could self-escalate to owner
  // or disable/demote the real owner.
  const actorIsOwner = canViewInviteLinks(auth.auth);
  if (role === "owner" && !actorIsOwner) {
    return NextResponse.json(
      { ok: false, message: "Only the owner can assign the owner role." },
      { status: 403 }
    );
  }
  if (!actorIsOwner && (role || status || name)) {
    const { data: targetRow } = await supabase
      .from("platform_users")
      .select("role")
      .eq("id", id)
      .maybeSingle();
    if (targetRow && normalizeRole(targetRow.role) === "owner") {
      return NextResponse.json(
        { ok: false, message: "Only the owner can modify an owner account." },
        { status: 403 }
      );
    }
  }

  let lastNotify: TeamNotifyResult | null = null;
  let updatedRole: string | undefined;

  if (password) {
    const { data: target } = await supabase
      .from("platform_users")
      .select("id, email, name, role, status, phone")
      .eq("id", id)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (normalizeRole(target.role) === "owner" && !canViewInviteLinks(auth.auth)) {
      return NextResponse.json(
        { ok: false, message: "Only the owner can set an owner account's password." },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);
    const passwordUpdates: Record<string, string> = { password_hash: passwordHash };
    // A user with a password no longer needs the invite flow to activate.
    if (target.status === "pending") {
      passwordUpdates.status = "active";
      passwordUpdates.activated_at = new Date().toISOString();
    }

    const { error: passwordError } = await supabase
      .from("platform_users")
      .update(passwordUpdates)
      .eq("id", id);

    if (passwordError) {
      return NextResponse.json(
        { ok: false, message: withSchemaMigrationHint(passwordError.message) },
        { status: 500 }
      );
    }

    await logPlatformActivity(auth.auth, "user_password_set", target.email, { user_id: id });
    lastNotify = await notifyTeamPasswordSetWhatsApp({
      phone: target.phone,
      name: target.name,
      userId: id,
    });
  }

  const updates: Record<string, string> = {};
  if (role) updates.role = role;
  if (name) updates.name = name;
  if (status) updates.status = status;

  if (Object.keys(updates).length > 0) {
    const { data: before } = role
      ? await supabase
          .from("platform_users")
          .select("id, name, phone, role")
          .eq("id", id)
          .maybeSingle()
      : { data: null };

    const { error } = await supabase.from("platform_users").update(updates).eq("id", id);
    if (error) {
      return NextResponse.json(
        { ok: false, message: withSchemaMigrationHint(error.message) },
        { status: 500 }
      );
    }
    await logPlatformActivity(auth.auth, "user_updated", id, updates);

    if (role) {
      updatedRole = role;
      if (before && normalizeRole(before.role) !== role) {
        lastNotify = await notifyTeamRoleChangedWhatsApp({
          phone: before.phone,
          name: name ?? before.name,
          role,
          userId: id,
        });
      }
    }
  }

  if (resendInvite || getInviteLink) {
    if (!canViewInviteLinks(auth.auth)) {
      return NextResponse.json({ ok: false, message: "Only the owner can access invite links." }, { status: 403 });
    }

    const { data: user } = await supabase
      .from("platform_users")
      .select("id, name, email, role, status, phone")
      .eq("id", id)
      .maybeSingle();

    if (!user || user.status === "active") {
      return NextResponse.json({ ok: false, message: "User is already active." }, { status: 400 });
    }

    let link: string;
    let expiresAt: string;
    try {
      ({ link, expiresAt } = await getOrRefreshInviteForUser(supabase, id, resendInvite));
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Could not refresh invite.";
      return NextResponse.json({ ok: false, message: withSchemaMigrationHint(raw) }, { status: 500 });
    }

    if (getInviteLink && !resendInvite) {
      return NextResponse.json({
        ok: true,
        ...ownerInvitePayload(link, expiresAt),
        user: { id: user.id, email: user.email, name: user.name },
      });
    }

    const emailResult = await sendPlatformInviteEmail({
      to: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      inviteUrl: link,
    });
    await logPlatformActivity(auth.auth, "invite_sent", user.email, {
      resent: resendInvite,
      email_sent: emailResult.emailSent,
      ...(emailResult.emailSent ? {} : { email_error: emailResult.emailError }),
    });
    const notify = await notifyTeamInviteWhatsApp({
      phone: user.phone,
      name: user.name,
      role: normalizeRole(user.role),
      inviteUrl: link,
      userId: user.id,
      resent: true,
    });

    return NextResponse.json({
      ok: true,
      ...ownerInvitePayload(link, expiresAt),
      emailSent: emailResult.emailSent,
      ...(emailResult.emailSent ? {} : { emailError: emailResult.emailError }),
      user: { id: user.id, email: user.email, name: user.name },
      ...notifyPayload(notify),
    });
  }

  return NextResponse.json({
    ok: true,
    ...(updatedRole ? { role: updatedRole } : {}),
    ...(lastNotify ? notifyPayload(lastNotify) : {}),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("users");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  let user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    deleted_at?: string | null;
    status?: string | null;
  } | null = null;
  let softDeleteSchemaReady = true;

  {
    const primary = await supabase
      .from("platform_users")
      .select("id, email, name, role, status, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (primary.error && isMissingDeletedAtError(primary.error.message)) {
      reportPlatformUsersDeletedAtIssue(
        primary.error.message,
        "platform-users.DELETE.select"
      );
      softDeleteSchemaReady = false;
      const fallback = await supabase
        .from("platform_users")
        .select("id, email, name, role, status")
        .eq("id", id)
        .maybeSingle();
      if (fallback.error) {
        return dbFailure(fallback.error, {
          module: "api.admin.platform-users.DELETE.load",
          message: "We could not load that team member. Try again.",
          request: req,
          actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
        });
      }
      user = fallback.data;
    } else if (primary.error) {
      return dbFailure(primary.error, {
        module: "api.admin.platform-users.DELETE.load",
        message: "We could not load that team member. Try again.",
        request: req,
        actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
      });
    } else {
      user = primary.data;
    }
  }

  if (!user) {
    return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
  }

  // Without deleted_at, treat an open trash entry as already deleted.
  if (!softDeleteSchemaReady) {
    const trashedIds = await listTrashedPlatformUserIds(supabase);
    if (trashedIds.has(id)) {
      return NextResponse.json(
        { ok: false, message: "User is already in trash." },
        { status: 400 }
      );
    }
  }

  const guard = assertPlatformUserDeletable(
    user,
    auth.auth.type === "user" ? auth.auth.userId : null
  );
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status });
  }

  // Cancel open invites so a soft-deleted user cannot accept later.
  await supabase.from("platform_user_invites").delete().eq("user_id", id).is("accepted_at", null);

  const result = await softDeleteEntity(supabase, auth.auth, "platform_user", id);
  if (!result.ok) {
    // Migration 078 missing: disable login + trash (list hides via trash ids).
    if (isMissingDeletedAtError(result.message)) {
      reportPlatformUsersDeletedAtIssue(result.message, "platform-users.DELETE");

      const { data: fullRow } = await supabase
        .from("platform_users")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const snapshot: Record<string, unknown> = {
        ...(user as Record<string, unknown>),
        ...((fullRow as Record<string, unknown> | null) ?? {}),
      };
      delete snapshot.password_hash;

      const name = String(snapshot.name ?? user.name ?? "").trim();
      const email = String(snapshot.email ?? user.email ?? "").trim();
      const label =
        name && email ? `${name} (${email})` : name || email || "Team user";

      const { error: disableError } = await supabase
        .from("platform_users")
        .update({ status: "disabled" })
        .eq("id", id);

      if (disableError) {
        return dbFailure(disableError, {
          module: "api.admin.platform-users.DELETE.disable",
          message: "We could not disable that account. Try again.",
          request: req,
          actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
        });
      }

      const trash = await recordTrashEntry(
        supabase,
        auth.auth,
        "platform_user",
        id,
        label,
        snapshot
      );

      await logPlatformActivity(auth.auth, "user_removed", user.email ?? id, {
        user_id: id,
        soft_delete: false,
        status_disabled_fallback: true,
        trashId: trash.ok ? trash.id : null,
      });

      if (!trash.ok) {
        return NextResponse.json({
          ok: true,
          fallback: "disabled",
          message:
            "User disabled. They can no longer sign in. Restore may be limited until a database update finishes.",
        });
      }

      return NextResponse.json({
        ok: true,
        trashId: trash.id,
        fallback: "disabled",
        message: "User moved to trash. Restore from Platform → Trash if needed.",
      });
    }

    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  // Soft-delete + disable so Users/lifecycle never still show Active.
  await supabase.from("platform_users").update({ status: "disabled" }).eq("id", id);

  await logPlatformActivity(auth.auth, "user_removed", user.email ?? id, {
    user_id: id,
    trashId: result.trashId,
    soft_delete: true,
  });

  return NextResponse.json({
    ok: true,
    trashId: result.trashId,
    message: "User moved to trash. Restore from Platform → Trash if needed.",
  });
}
