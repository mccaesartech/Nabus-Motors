import { cookies } from "next/headers";
import { ADMIN_COOKIE, expectedAdminToken, PLATFORM_USER_COOKIE } from "@/lib/admin/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/platform/password";
import {
  createPlatformSessionToken,
  parseLegacyPlatformSessionCookie,
  parsePlatformSessionCookieValue,
  passwordHashFingerprint,
} from "@/lib/platform/session";
import {
  hasPermission,
  normalizeRole,
  type PlatformPermission,
  type PlatformRole,
} from "@/lib/platform/permissions";

export type PlatformAuthContext = {
  type: "owner" | "user";
  userId?: string;
  name: string;
  email: string;
  role: PlatformRole;
  /** Present after password verification — used to mint session cookies without another DB read. */
  passwordHash?: string;
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
};

async function loadActivePlatformUser(userId: string) {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("platform_users")
    .select("id, name, email, role, status, password_hash")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== "active" || !data.password_hash) return null;
  return data;
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
  };
}

export type PlatformLoginResult =
  | { status: "success"; auth: PlatformAuthContext }
  | { status: "invalid" }
  /** Account exists but has no password yet — the user must create one (entered twice). */
  | { status: "needs_password_setup" }
  | { status: "password_setup_failed"; message: string };

const MIN_PLATFORM_PASSWORD_LENGTH = 8;

export async function authenticatePlatformUser(
  email: string,
  password: string,
  confirmPassword?: string
): Promise<PlatformLoginResult> {
  const supabase = createAdminSupabase();
  if (!supabase) return { status: "invalid" };

  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("platform_users")
    .select("id, name, email, role, status, password_hash")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error || !data) return { status: "invalid" };
  if (data.status === "disabled") return { status: "invalid" };

  // No password on file (invited but never activated): the first password the
  // user chooses at sign-in becomes their password. It must be entered twice.
  if (!data.password_hash) {
    if (typeof confirmPassword !== "string") {
      return { status: "needs_password_setup" };
    }
    if (password.length < MIN_PLATFORM_PASSWORD_LENGTH) {
      return {
        status: "password_setup_failed",
        message: `Password must be at least ${MIN_PLATFORM_PASSWORD_LENGTH} characters.`,
      };
    }
    if (password !== confirmPassword) {
      return { status: "password_setup_failed", message: "Passwords do not match." };
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("platform_users")
      .update({
        password_hash: passwordHash,
        status: "active",
        activated_at: data.status === "active" ? undefined : now,
        last_login_at: now,
      })
      .eq("id", data.id)
      .is("password_hash", null);

    if (updateError) {
      return { status: "password_setup_failed", message: "Could not save password. Try again." };
    }

    return {
      status: "success",
      auth: {
        type: "user",
        userId: data.id,
        name: data.name,
        email: data.email,
        role: normalizeRole(data.role),
        passwordHash,
      },
    };
  }

  if (data.status !== "active") return { status: "invalid" };

  const valid = await verifyPassword(password, data.password_hash);
  if (!valid) return { status: "invalid" };

  await supabase
    .from("platform_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    status: "success",
    auth: {
      type: "user",
      userId: data.id,
      name: data.name,
      email: data.email,
      role: normalizeRole(data.role),
      passwordHash: data.password_hash,
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

/** Bootstrap owner session or platform user with owner role — can view/manage invite links. */
export function canViewInviteLinks(auth: PlatformAuthContext): boolean {
  return auth.type === "owner" || auth.role === "owner";
}

/** Owner, super admin, manager, and staff with customers access can send customer password resets. */
export function canSendCustomerPasswordReset(auth: PlatformAuthContext): boolean {
  if (auth.type === "owner" || auth.role === "owner") return true;
  if (auth.role === "super_admin" || auth.role === "manager") return true;
  return hasPermission(auth.role, "customers");
}

/** Owner, super admin, and manager can copy one-time reset links (manual WhatsApp fallback). */
export function canCopyCustomerPasswordResetLink(auth: PlatformAuthContext): boolean {
  if (auth.type === "owner" || auth.role === "owner") return true;
  return auth.role === "super_admin" || auth.role === "manager";
}

/** Only the bootstrap owner or platform users with owner role can delete customers. */
export function canDeleteCustomer(auth: PlatformAuthContext): boolean {
  return auth.type === "owner" || auth.role === "owner";
}

/** Owner, super admin, and manager can view trash and restore items. */
export function canManageTrash(auth: PlatformAuthContext): boolean {
  return (
    auth.type === "owner" ||
    auth.role === "owner" ||
    auth.role === "super_admin" ||
    auth.role === "manager"
  );
}

/** Only the bootstrap owner or platform owner role can permanently delete from trash. */
export function canPermanentlyDeleteTrash(auth: PlatformAuthContext): boolean {
  return auth.type === "owner" || auth.role === "owner";
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

export async function requireAdmin() {
  const auth = await getPlatformAuth();
  if (!auth) {
    return {
      ok: false as const,
      status: 401,
      message: "Session expired. Please sign in again.",
    };
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
