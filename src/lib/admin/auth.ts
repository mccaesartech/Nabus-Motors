import { cookies } from "next/headers";
import { ADMIN_COOKIE, expectedAdminToken, PLATFORM_USER_COOKIE } from "@/lib/admin/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/platform/password";
import {
  createPlatformSessionToken,
  parseLegacyPlatformSessionCookie,
  parsePlatformSessionCookieValue,
  passwordHashFingerprint,
} from "@/lib/platform/session";
import {
  canMutateFreight,
  canViewFinance,
  hasPermission,
  normalizeRole,
  type PlatformPermission,
  type PlatformRole,
} from "@/lib/platform/permissions";
import {
  canDirectMutate,
  MUTATION_APPROVAL_REQUIRED_MESSAGE,
} from "@/lib/platform/mutation-approval";
import {
  isMissingColumnError,
  reportSchemaIssue,
} from "@/lib/observability/schema-issue";
import {
  SCHEMA_CAPS,
  isSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";
import { isApiAllowedDuringPasswordChange } from "@/lib/platform/paths";

export type PlatformAuthContext = {
  type: "owner" | "user";
  userId?: string;
  name: string;
  email: string;
  role: PlatformRole;
  /** Present after password verification — used to mint session cookies without another DB read. */
  passwordHash?: string;
  /** When true, user must change password before accessing the platform. */
  mustChangePassword?: boolean;
};

export type PlatformUserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  password_hash: string | null;
  phone: string | null;
  job_title: string | null;
  created_at: string;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  must_change_password?: boolean;
};

type ActivePlatformUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  password_hash: string | null;
  must_change_password?: boolean;
  deleted_at?: string | null;
};

async function loadActivePlatformUser(userId: string) {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const skipDeletedAt = isSchemaMissing(SCHEMA_CAPS.platformUsersDeletedAt);
  const skipMustChange = isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword);
  const baseSelect = skipMustChange
    ? "id, name, email, role, status, password_hash"
    : "id, name, email, role, status, password_hash, must_change_password";
  const primary = skipDeletedAt
    ? await supabase.from("platform_users").select(baseSelect).eq("id", userId).maybeSingle()
    : await supabase
        .from("platform_users")
        .select(`${baseSelect}, deleted_at`)
        .eq("id", userId)
        .is("deleted_at", null)
        .maybeSingle();

  let data = primary.data as {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    password_hash: string | null;
    must_change_password?: boolean;
    deleted_at?: string | null;
  } | null;
  if (primary.error && isMissingColumnError(primary.error.message, "deleted_at")) {
    reportSchemaIssue({
      table: "platform_users",
      column: "deleted_at",
      migration: "078_platform_user_soft_delete.sql / 086_postgres_error_clearance.sql",
      source: "admin.auth.loadActivePlatformUser",
      message: primary.error.message,
    });
    const fallbackSelect = skipMustChange
      ? "id, name, email, role, status, password_hash"
      : "id, name, email, role, status, password_hash, must_change_password";
    const fallback = await supabase
      .from("platform_users")
      .select(fallbackSelect)
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    data = { ...(fallback.data as unknown as ActivePlatformUserRow), deleted_at: null };
  } else if (
    primary.error &&
    isMissingColumnError(primary.error.message, "must_change_password")
  ) {
    reportSchemaIssue({
      table: "platform_users",
      column: "must_change_password",
      migration: "097_platform_must_change_password.sql",
      source: "admin.auth.loadActivePlatformUser",
      message: primary.error.message,
    });
    const fallback = await supabase
      .from("platform_users")
      .select("id, name, email, role, status, password_hash")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    data = {
      ...(fallback.data as unknown as ActivePlatformUserRow),
      deleted_at: null,
      must_change_password: false,
    };
  } else if (primary.error || !data) {
    return null;
  } else if (!skipDeletedAt) {
    markSchemaPresent(SCHEMA_CAPS.platformUsersDeletedAt);
  }

  if (!skipMustChange && data && primary.data && !primary.error) {
    markSchemaPresent(SCHEMA_CAPS.platformUsersMustChangePassword);
  }

  if (!data || data.status !== "active" || !data.password_hash) return null;
  const passwordHash: string = data.password_hash;
  return { ...data, password_hash: passwordHash };
}

export async function platformUserMustChangePassword(userId: string): Promise<boolean> {
  if (isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword)) return false;

  const supabase = createAdminSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("platform_users")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (error && isMissingColumnError(error.message, "must_change_password")) {
    reportSchemaIssue({
      table: "platform_users",
      column: "must_change_password",
      migration: "097_platform_must_change_password.sql",
      source: "admin.auth.platformUserMustChangePassword",
      message: error.message,
    });
    return false;
  }

  if (!error) {
    markSchemaPresent(SCHEMA_CAPS.platformUsersMustChangePassword);
  }

  return Boolean(data?.must_change_password);
}

export async function verifyPlatformSessionCookie(
  cookieValue: string | undefined
): Promise<PlatformAuthContext | null> {
  const payload = await parsePlatformSessionCookieValue(cookieValue);
  if (payload) {
    const data = await loadActivePlatformUser(payload.uid);
    if (!data) return null;

    const pwdFp = await passwordHashFingerprint(data.password_hash);
    if (pwdFp !== payload.pwd) return null;

    return {
      type: "user",
      userId: data.id,
      name: data.name,
      email: data.email,
      role: normalizeRole(data.role),
      mustChangePassword: Boolean(data.must_change_password),
    };
  }

  // Legacy cookie format (pre-signed sessions) — one release migration path.
  const legacy = parseLegacyPlatformSessionCookie(cookieValue);
  if (!legacy) return null;

  const data = await loadActivePlatformUser(legacy.userId);
  if (!data) return null;

  const expected = await createPlatformSessionToken(data.id, data.password_hash);
  if (expected !== legacy.token) return null;

  return {
    type: "user",
    userId: data.id,
    name: data.name,
    email: data.email,
    role: normalizeRole(data.role),
    mustChangePassword: Boolean(data.must_change_password),
  };
}

export type PlatformLoginResult =
  | { status: "success"; auth: PlatformAuthContext }
  | { status: "invalid" }
  /**
   * Invited account with no password yet. Activation must go through the
   * single-use invite token flow (`/api/admin/invite/accept`) — never login.
   */
  | { status: "invite_required" };

export async function authenticatePlatformUser(
  email: string,
  password: string
): Promise<PlatformLoginResult> {
  const supabase = createAdminSupabase();
  if (!supabase) return { status: "invalid" };

  const normalizedEmail = email.trim().toLowerCase();
  const skipDeletedAt = isSchemaMissing(SCHEMA_CAPS.platformUsersDeletedAt);
  const skipMustChange = isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword);
  const baseSelect = skipMustChange
    ? "id, name, email, role, status, password_hash"
    : "id, name, email, role, status, password_hash, must_change_password";
  const primary = skipDeletedAt
    ? await supabase.from("platform_users").select(baseSelect).eq("email", normalizedEmail).maybeSingle()
    : await supabase
        .from("platform_users")
        .select(`${baseSelect}, deleted_at`)
        .eq("email", normalizedEmail)
        .is("deleted_at", null)
        .maybeSingle();

  let data = primary.data as {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    password_hash: string | null;
    must_change_password?: boolean;
    deleted_at?: string | null;
  } | null;
  if (primary.error && isMissingColumnError(primary.error.message, "deleted_at")) {
    reportSchemaIssue({
      table: "platform_users",
      column: "deleted_at",
      migration: "078_platform_user_soft_delete.sql / 086_postgres_error_clearance.sql",
      source: "admin.auth.authenticatePlatformUser",
      message: primary.error.message,
    });
    const fallbackSelect = skipMustChange
      ? "id, name, email, role, status, password_hash"
      : "id, name, email, role, status, password_hash, must_change_password";
    const fallback = await supabase
      .from("platform_users")
      .select(fallbackSelect)
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (fallback.error || !fallback.data) return { status: "invalid" };
    data = { ...(fallback.data as unknown as ActivePlatformUserRow), deleted_at: null };
  } else if (
    primary.error &&
    isMissingColumnError(primary.error.message, "must_change_password")
  ) {
    reportSchemaIssue({
      table: "platform_users",
      column: "must_change_password",
      migration: "097_platform_must_change_password.sql",
      source: "admin.auth.authenticatePlatformUser",
      message: primary.error.message,
    });
    const fallback = await supabase
      .from("platform_users")
      .select("id, name, email, role, status, password_hash")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (fallback.error || !fallback.data) return { status: "invalid" };
    data = {
      ...(fallback.data as unknown as ActivePlatformUserRow),
      deleted_at: null,
      must_change_password: false,
    };
  } else if (primary.error || !data) {
    return { status: "invalid" };
  } else if (!skipDeletedAt) {
    markSchemaPresent(SCHEMA_CAPS.platformUsersDeletedAt);
  }

  if (!skipMustChange && data && primary.data && !primary.error) {
    markSchemaPresent(SCHEMA_CAPS.platformUsersMustChangePassword);
  }

  if (!data) return { status: "invalid" };

  if (data.status === "disabled") return { status: "invalid" };

  // Pending invite with no password: do NOT allow activation from /api/admin/login.
  // Anyone who knew the email could otherwise set the password and take the account.
  if (!data.password_hash) {
    return { status: "invite_required" };
  }

  // Password already set server-side (admin-assigned or prior activation): verify.
  // Pending+hash is allowed only when the hash was stored by an admin — never via login.
  if (data.status !== "active" && data.status !== "pending") {
    return { status: "invalid" };
  }

  const valid = await verifyPassword(password, data.password_hash);
  if (!valid) return { status: "invalid" };

  const now = new Date().toISOString();
  const loginUpdates: Record<string, string> = { last_login_at: now };
  if (data.status === "pending") {
    loginUpdates.status = "active";
    loginUpdates.activated_at = now;
  }

  await supabase.from("platform_users").update(loginUpdates).eq("id", data.id);

  // If they activated via /admin with an admin-assigned temp password, close
  // any open invite tokens so Copy link no longer shows a usable URL.
  if (data.status === "pending") {
    await supabase
      .from("platform_user_invites")
      .update({ accepted_at: now })
      .eq("user_id", data.id)
      .is("accepted_at", null);
  }

  return {
    status: "success",
    auth: {
      type: "user",
      userId: data.id,
      name: data.name,
      email: data.email,
      role: normalizeRole(data.role),
      passwordHash: data.password_hash,
      mustChangePassword: Boolean(data.must_change_password),
    },
  };
}

export async function getOwnerBootstrapAuth(): Promise<PlatformAuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const expected = await expectedAdminToken();
  if (!token || !expected || token !== expected) return null;

  return {
    type: "owner",
    name: "Owner",
    email: process.env.OWNER_EMAIL ?? "owner@truegoshenauto.com",
    role: "owner",
  };
}

/** True platform owner (bootstrap cookie or owner role) — not super_admin. */
export function isPlatformOwnerActor(auth: PlatformAuthContext): boolean {
  return auth.type === "owner" || auth.role === "owner";
}

/** Owner or super_admin can view/manage invite links (system user ops). */
export function canViewInviteLinks(auth: PlatformAuthContext): boolean {
  return isPlatformOwnerActor(auth) || auth.role === "super_admin";
}

/** Owner or super_admin may read the immutable audit log (not manager/staff). */
export function canViewAuditLog(auth: PlatformAuthContext): boolean {
  return isPlatformOwnerActor(auth) || auth.role === "super_admin";
}

/** Owner, super admin, manager, and staff with customers access can send customer password resets. */
export function canSendCustomerPasswordReset(auth: PlatformAuthContext): boolean {
  if (isPlatformOwnerActor(auth) || auth.role === "super_admin" || auth.role === "manager") {
    return true;
  }
  return hasPermission(auth.role, "customers");
}

/** Owner, super admin, and manager can copy one-time reset links (manual WhatsApp fallback). */
export function canCopyCustomerPasswordResetLink(auth: PlatformAuthContext): boolean {
  return isPlatformOwnerActor(auth) || auth.role === "super_admin" || auth.role === "manager";
}

/** Owner or super_admin can delete customers (destructive / lifecycle). */
export function canDeleteCustomer(auth: PlatformAuthContext): boolean {
  return isPlatformOwnerActor(auth) || auth.role === "super_admin";
}

/** Roles with the `trash` permission can view trash and restore items (not manager). */
export function canManageTrash(auth: PlatformAuthContext): boolean {
  if (auth.type === "owner") return true;
  return hasPermission(auth.role, "trash");
}

/** Owner or super admin can permanently delete from trash. */
export function canPermanentlyDeleteTrash(auth: PlatformAuthContext): boolean {
  return (
    auth.type === "owner" ||
    auth.role === "owner" ||
    auth.role === "super_admin"
  );
}

export async function getPlatformAuth(): Promise<PlatformAuthContext | null> {
  const owner = await getOwnerBootstrapAuth();
  if (owner) return owner;

  const cookieStore = await cookies();
  const platformCookie = cookieStore.get(PLATFORM_USER_COOKIE)?.value;
  return verifyPlatformSessionCookie(platformCookie);
}

export async function isAdminAuthed(): Promise<boolean> {
  return Boolean(await getPlatformAuth());
}

export async function requireAdmin(options?: {
  /** Allow routes needed to complete a forced password change. */
  allowPasswordChangePending?: boolean;
  /** Request pathname for API allow-list checks (e.g. from headers). */
  requestPath?: string;
}) {
  const auth = await getPlatformAuth();
  if (!auth) {
    return {
      ok: false as const,
      status: 401,
      message: "Session expired. Please sign in again.",
    };
  }

  if (
    !options?.allowPasswordChangePending &&
    auth.type === "user" &&
    auth.userId
  ) {
    const mustChange =
      auth.mustChangePassword ?? (await platformUserMustChangePassword(auth.userId));
    if (mustChange) {
      const allowedPath = options?.requestPath
        ? isApiAllowedDuringPasswordChange(options.requestPath)
        : false;
      if (!allowedPath) {
        return {
          ok: false as const,
          status: 403,
          message: "You must set a new password before continuing.",
          mustChangePassword: true as const,
          auth,
        };
      }
    }
  }

  return { ok: true as const, auth };
}

export async function requirePermission(permission: PlatformPermission) {
  const result = await requireAdmin();
  if (!result.ok) return result;

  if (!hasPermission(result.auth.role, permission)) {
    return {
      ok: false as const,
      status: 403,
      message: "You do not have permission to perform this action.",
      auth: result.auth,
    };
  }

  return { ok: true as const, auth: result.auth };
}

/** Revenue, expenses, and profit — owner and super_admin only. */
export async function requireFinanceAccess() {
  const result = await requireAdmin();
  if (!result.ok) return result;

  if (!canViewFinance(result.auth.role)) {
    return {
      ok: false as const,
      status: 403,
      message: "You do not have permission to view business finance.",
      auth: result.auth,
    };
  }

  return { ok: true as const, auth: result.auth };
}

/**
 * Freight shipment create/update — managers and freight officers included.
 * Permanent deletes still use requireDirectMutation.
 */
export async function requireFreightMutation() {
  const result = await requirePermission("freight");
  if (!result.ok) return result;

  if (result.auth.type === "owner") return result;
  if (!canMutateFreight(result.auth.role)) {
    return {
      ok: false as const,
      status: 403,
      message: MUTATION_APPROVAL_REQUIRED_MESSAGE,
      auth: result.auth,
    };
  }

  return result;
}

/**
 * Permission check plus Owner/Super Admin write gate.
 * Use for sales/freight/parts/customer mutations that have no pending-approval queue.
 * Inventory create/edit keeps the pending_approval path instead.
 */
export async function requireDirectMutation(permission: PlatformPermission) {
  const result = await requirePermission(permission);
  if (!result.ok) return result;

  if (result.auth.type === "owner") return result;
  if (!canDirectMutate(result.auth.role)) {
    return {
      ok: false as const,
      status: 403,
      message: MUTATION_APPROVAL_REQUIRED_MESSAGE,
      auth: result.auth,
    };
  }

  return result;
}
