import { NextRequest, NextResponse } from "next/server";
import { canViewInviteLinks, requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { INVITABLE_ROLES, ROLE_LABELS, normalizeRole } from "@/lib/platform/permissions";
import { generateToken, hashPassword, hashToken } from "@/lib/platform/password";
import { buildPlatformInviteUrl } from "@/lib/platform/invite-url";
import { logPlatformActivity } from "@/lib/platform/activity";
import { sendPlatformInviteEmail, getPlatformEmailConfig } from "@/lib/email/platform-invite";
import type { PlatformUserInviteInfo } from "@/lib/platform/modules";
import {
  computePlatformInviteExpiresAt,
  isPlatformInviteExpired,
} from "@/lib/platform/invite-ttl";

export const dynamic = "force-dynamic";

function withSchemaMigrationHint(message: string): string {
  if (/sender_anonymized|token_plain|schema cache/i.test(message)) {
    return "Database update required: run 026_platform_production_schema_fixes.sql in the Supabase SQL editor, then retry.";
  }
  return message;
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
      const message = error instanceof Error ? error.message : "Could not generate invite link.";
      return NextResponse.json({ ok: false, message }, { status: 500 });
    }
  }

  const [{ data: users, error: usersError }, { data: invites, error: invitesError }] =
    await Promise.all([
      supabase.from("platform_users").select("*").order("created_at", { ascending: false }),
      isOwner
        ? supabase
            .from("platform_user_invites")
            .select("id, user_id, expires_at, accepted_at, created_at, token_plain")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (usersError) {
    console.error("platform_users fetch failed:", usersError.message);
  }
  if (invitesError) {
    console.error("platform_user_invites fetch failed:", invitesError.message);
  }

  const inviteLinksSchemaReady = !invitesError;
  const inviteLinksSchemaError = invitesError?.message ?? null;

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
    canViewInviteLinks: isOwner,
    inviteLinksSchemaReady,
    inviteLinksSchemaError,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("users");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = normalizeRole(String(body.role ?? "staff"));
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!name || !email) {
    return NextResponse.json({ ok: false, message: "Name and email required" }, { status: 400 });
  }

  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, message: "Invalid role for invitation" }, { status: 400 });
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
        { ok: false, message: duplicate ? "A user with this email already exists." : userError.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    await logPlatformActivity(auth.auth, "user_password_set", email, {
      user_id: user.id,
      role,
      created_with_password: true,
    });

    return NextResponse.json({
      ok: true,
      passwordSet: true,
      user: { ...user, password_hash: undefined, role, status: "active" },
      emailSent: false,
      emailConfigured: getPlatformEmailConfig().configured,
    });
  }

  const { data: user, error: userError } = await supabase
    .from("platform_users")
    .insert({
      name,
      email,
      role,
      status: "pending",
      invited_at: now,
    })
    .select()
    .single();

  if (userError) {
    const duplicate = userError.message.toLowerCase().includes("duplicate");
    return NextResponse.json(
      { ok: false, message: duplicate ? "A user with this email already exists." : userError.message },
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

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      role,
      status: "pending",
    },
    ...(canViewInviteLinks(auth.auth) ? ownerInvitePayload(link, expiresAt) : {}),
    emailSent: emailResult.emailSent,
    emailConfigured: getPlatformEmailConfig().configured,
    ...(emailResult.emailSent ? {} : { emailError: emailResult.emailError }),
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

  if (password) {
    const { data: target } = await supabase
      .from("platform_users")
      .select("id, email, role, status")
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
      return NextResponse.json({ ok: false, message: passwordError.message }, { status: 500 });
    }

    await logPlatformActivity(auth.auth, "user_password_set", target.email, { user_id: id });
  }

  const updates: Record<string, string> = {};
  if (role) updates.role = role;
  if (name) updates.name = name;
  if (status) updates.status = status;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("platform_users").update(updates).eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    await logPlatformActivity(auth.auth, "user_updated", id, updates);
  }

  if (resendInvite || getInviteLink) {
    if (!canViewInviteLinks(auth.auth)) {
      return NextResponse.json({ ok: false, message: "Only the owner can access invite links." }, { status: 403 });
    }

    const { data: user } = await supabase
      .from("platform_users")
      .select("id, name, email, role, status")
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

    return NextResponse.json({
      ok: true,
      ...ownerInvitePayload(link, expiresAt),
      emailSent: emailResult.emailSent,
      ...(emailResult.emailSent ? {} : { emailError: emailResult.emailError }),
      user: { id: user.id, email: user.email, name: user.name },
    });
  }

  return NextResponse.json({ ok: true });
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

  const { data: user } = await supabase
    .from("platform_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("platform_user_invites").delete().eq("user_id", id);

  // Mark messages before delete so ON DELETE SET NULL does not violate sender checks.
  const [{ error: platformMsgError }, { error: customerMsgError }] = await Promise.all([
    supabase
      .from("platform_messages")
      .update({ sender_anonymized: true })
      .eq("sender_user_id", id),
    supabase
      .from("customer_conversation_messages")
      .update({ sender_anonymized: true })
      .eq("sender_user_id", id),
  ]);

  if (platformMsgError) {
    return NextResponse.json(
      { ok: false, message: withSchemaMigrationHint(platformMsgError.message) },
      { status: 500 }
    );
  }
  if (customerMsgError) {
    return NextResponse.json(
      { ok: false, message: withSchemaMigrationHint(customerMsgError.message) },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("platform_users").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  await logPlatformActivity(auth.auth, "user_removed", user?.email ?? id);
  return NextResponse.json({ ok: true });
}
