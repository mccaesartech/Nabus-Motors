import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPlatformAdminLoginUrl,
  buildTeamInviteMessage,
  buildTeamLoginAlertMessage,
  buildTeamFailedLoginAlertMessage,
  buildTeamPasswordChangedMessage,
  buildTeamPasswordSetMessage,
} from "@/lib/notifications/platform-team-whatsapp";
import { buildPlatformInviteUrl } from "@/lib/platform/invite-url";
import { PRODUCTION_PUBLIC_SITE_URL } from "@/lib/site-url";

describe("team invite / password message builders", () => {
  it("invite SMS URL matches buildPlatformInviteUrl (same as Copy link)", () => {
    const inviteUrl = buildPlatformInviteUrl("abc", PRODUCTION_PUBLIC_SITE_URL);
    expect(inviteUrl).toBe(
      "https://www.nabusmotors.com/admin/platform/invite/abc"
    );

    const text = buildTeamInviteMessage({
      name: "Ama",
      role: "staff",
      inviteUrl,
    });

    expect(text).toContain("you're invited as");
    expect(text).toContain("Staff");
    expect(text).toContain(inviteUrl);
    expect(text).not.toMatch(/Temporary password/i);
    expect(text).not.toMatch(/password:/i);
    expect(text).not.toContain("vercel.app");
    expect(text).not.toMatch(/https:\/\/[^/]+\/platform\/invite\//);
  });

  it("password-set SMS includes temporary password, role label, and invite URL", () => {
    const inviteUrl = buildPlatformInviteUrl(
      "token123",
      PRODUCTION_PUBLIC_SITE_URL
    );
    const text = buildTeamPasswordSetMessage({
      name: "Kojo",
      role: "staff",
      loginUrl: inviteUrl,
      temporaryPassword: "TempPass-Example",
      linkKind: "invite",
    });

    expect(text).toContain("your Staff account is ready");
    expect(text).not.toMatch(/admin account/i);
    expect(text).toContain("Temporary password: TempPass-Example");
    expect(text).toContain(inviteUrl);
    expect(text).toContain("Accept invite:");
    expect(text).not.toMatch(/Sign in at/i);
  });

  it("active-account password-reset SMS uses staff login URL", () => {
    const loginUrl = buildPlatformAdminLoginUrl(PRODUCTION_PUBLIC_SITE_URL);
    const text = buildTeamPasswordSetMessage({
      name: "Kojo",
      role: "manager",
      loginUrl,
      temporaryPassword: "TempPass-Example",
      linkKind: "login",
    });

    expect(text).toContain("your Manager password was updated");
    expect(text).not.toMatch(/admin account/i);
    expect(text).toContain("Temporary password: TempPass-Example");
    expect(text).toContain(loginUrl);
    expect(text).toMatch(/Sign in at/i);
    expect(loginUrl).toBe("https://www.nabusmotors.com/admin");
  });

  it("infers invite linkKind from invite acceptance URL path", () => {
    const inviteUrl = buildPlatformInviteUrl(
      "token123",
      PRODUCTION_PUBLIC_SITE_URL
    );
    const text = buildTeamPasswordSetMessage({
      name: "Kojo",
      role: "super_admin",
      loginUrl: inviteUrl,
      temporaryPassword: "TempPass-Example",
    });

    expect(text).toContain("your Super Admin account is ready");
    expect(text).toContain("Accept invite:");
    expect(text).toContain(inviteUrl);
    expect(text).not.toMatch(
      /Sign in at https:\/\/www\.nabusmotors\.com\/admin(?!\/platform\/invite)/
    );
  });

  it("password-set SMS omits password when not provided", () => {
    const loginUrl = "https://www.nabusmotors.com/admin";
    const text = buildTeamPasswordSetMessage({
      name: "Kojo",
      role: "staff",
      loginUrl,
    });

    expect(text).toContain(loginUrl);
    expect(text).toMatch(/password was set/i);
    expect(text).not.toMatch(/Temporary password/i);
    expect(text).not.toMatch(/admin account/i);
  });

  it("login alert SMS includes role, time, IP, and security link", () => {
    const securityUrl =
      "https://www.nabusmotors.com/admin/platform/account/security";
    const text = buildTeamLoginAlertMessage({
      name: "Ama",
      role: "manager",
      when: "Aug 4, 2026, 9:00 PM",
      ip: "203.0.113.10",
      securityUrl,
    });

    expect(text).toContain("you signed in to your Manager account");
    expect(text).toContain("Aug 4, 2026, 9:00 PM");
    expect(text).toContain("Approximate IP: 203.0.113.10");
    expect(text).toContain(securityUrl);
    expect(text).not.toMatch(/admin account/i);
  });

  it("failed login alert SMS includes role, device, IP, and security link", () => {
    const securityUrl =
      "https://www.nabusmotors.com/admin/platform/account/security";
    const text = buildTeamFailedLoginAlertMessage({
      name: "Ama",
      role: "manager",
      when: "Aug 4, 2026, 9:00 PM",
      ip: "203.0.113.10",
      device: "Chrome on Windows (Desktop)",
      securityUrl,
    });

    expect(text).toMatch(/failed to sign in/i);
    expect(text).toContain("Aug 4, 2026, 9:00 PM");
    expect(text).toContain("Approximate IP: 203.0.113.10");
    expect(text).toContain("Chrome on Windows (Desktop)");
    expect(text).toContain(securityUrl);
  });

  it("password-changed SMS confirms change without including the new password", () => {
    const securityUrl =
      "https://www.nabusmotors.com/admin/platform/account/security";
    const text = buildTeamPasswordChangedMessage({
      name: "Ama",
      when: "Aug 4, 2026, 9:51 PM",
      ip: "203.0.113.10",
      securityUrl,
    });

    expect(text).toMatch(/password was changed/i);
    expect(text).toContain("Aug 4, 2026, 9:51 PM");
    expect(text).toContain("Approximate IP: 203.0.113.10");
    expect(text).toContain(securityUrl);
    expect(text).not.toMatch(/Temporary password/i);
    expect(text).not.toMatch(/password:/i);
  });
});
