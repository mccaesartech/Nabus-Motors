import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildPlatformInviteEmailContent } from "@/lib/email/platform-invite";
import { buildPlatformInviteUrl } from "@/lib/platform/invite-url";
import { PRODUCTION_PUBLIC_SITE_URL } from "@/lib/site-url";

const LOGIN_URL = "https://www.truegoshengh.com/admin";
const INVITE_TOKEN = "token123";
const INVITE_URL = buildPlatformInviteUrl(INVITE_TOKEN, PRODUCTION_PUBLIC_SITE_URL);

describe("buildPlatformInviteEmailContent", () => {
  it("invite-without-password email URL matches buildPlatformInviteUrl / Copy link", () => {
    expect(INVITE_URL).toBe(
      "https://www.truegoshengh.com/admin/platform/invite/token123"
    );

    const mail = buildPlatformInviteEmailContent({
      name: "Kojo Boateng",
      role: "manager",
      inviteUrl: INVITE_URL,
    });

    expect(mail.subject).toBe("You're invited to True Goshen as Manager");
    expect(mail.html).toContain("You're invited as Manager");
    expect(mail.text).toContain(INVITE_URL);
    expect(mail.html).toContain(`href="${INVITE_URL}"`);
    expect(mail.text).toMatch(/Set your password and activate/i);
    expect(mail.text).not.toMatch(/Temporary password/i);
    expect(mail.html).not.toMatch(/Temporary password/i);
    expect(mail.html).toContain("Accept invitation");
    expect(mail.html).not.toMatch(/href="https:\/\/www\.truegoshengh\.com\/admin"/);
    expect(mail.text).not.toContain("vercel.app");
    expect(mail.html).not.toMatch(/admin account/i);
    expect(mail.subject).not.toMatch(/Admin account/i);
  });

  it("Staff credentials email uses role phrasing and invite acceptance URL", () => {
    const mail = buildPlatformInviteEmailContent({
      name: "Ama Mensah",
      role: "staff",
      inviteUrl: INVITE_URL,
      temporaryPassword: "TempPass-Example",
      linkKind: "invite",
    });

    expect(mail.subject).toBe("Your True Goshen Staff account");
    expect(mail.html).toContain("You're invited — set up your Staff account");
    expect(mail.html).not.toMatch(/admin account/i);
    expect(mail.subject).not.toMatch(/Admin account/i);
    expect(mail.text).toContain("Temporary password: TempPass-Example");
    expect(mail.text).toContain(INVITE_URL);
    expect(mail.text).toMatch(/Accept your invitation here:/i);
    expect(mail.text).not.toMatch(/Sign in here:/i);
    expect(mail.text).not.toMatch(
      /Sign in at https:\/\/www\.truegoshengh\.com\/admin(?!\/platform\/invite)/
    );

    expect(mail.html).toContain("Temporary password:");
    expect(mail.html).toContain("TempPass-Example");
    expect(mail.html).toContain(INVITE_URL);
    expect(mail.html).toContain("Accept invitation");
    expect(mail.html).not.toMatch(/href="https:\/\/www\.truegoshengh\.com\/admin"/);
  });

  it("uses role-specific subjects for Manager, Super Admin, and Owner", () => {
    expect(
      buildPlatformInviteEmailContent({
        name: "A",
        role: "manager",
        inviteUrl: INVITE_URL,
        temporaryPassword: "x",
        linkKind: "invite",
      }).subject
    ).toBe("Your True Goshen Manager account");

    expect(
      buildPlatformInviteEmailContent({
        name: "A",
        role: "super_admin",
        inviteUrl: INVITE_URL,
        temporaryPassword: "x",
        linkKind: "invite",
      }).subject
    ).toBe("Your True Goshen Super Admin account");

    expect(
      buildPlatformInviteEmailContent({
        name: "A",
        role: "owner",
        inviteUrl: LOGIN_URL,
        temporaryPassword: "x",
        linkKind: "login",
      }).subject
    ).toBe("Your True Goshen Owner account");
  });

  it("active-account password-reset credentials email may use /admin login", () => {
    const mail = buildPlatformInviteEmailContent({
      name: "Ama Mensah",
      role: "staff",
      inviteUrl: LOGIN_URL,
      temporaryPassword: "TempPass-Example",
      linkKind: "login",
    });

    expect(mail.subject).toBe("Your True Goshen Staff account");
    expect(mail.html).toContain("Your Staff account is ready");
    expect(mail.html).not.toMatch(/admin account/i);
    expect(mail.text).toContain("Temporary password: TempPass-Example");
    expect(mail.text).toContain(LOGIN_URL);
    expect(mail.text).toMatch(/Sign in here:/i);
    expect(mail.html).toContain("Sign in");
    expect(mail.text).not.toMatch(/\/admin\/platform\/invite\//);
  });

  it("never treats bare /admin as an invite acceptance link", () => {
    const mail = buildPlatformInviteEmailContent({
      name: "Ama Mensah",
      role: "staff",
      inviteUrl: INVITE_URL,
      temporaryPassword: "TempPass-Example",
    });

    expect(mail.text).toContain(INVITE_URL);
    expect(mail.html).toContain(`href="${INVITE_URL}"`);
    expect(mail.html).not.toMatch(/href="https:\/\/www\.truegoshengh\.com\/admin"/);
    expect(mail.text).toMatch(/\/admin\/platform\/invite\//);
  });

  it("escapes password and name in HTML", () => {
    const mail = buildPlatformInviteEmailContent({
      name: "Ama <b>x</b>",
      role: "staff",
      inviteUrl: INVITE_URL,
      temporaryPassword: "<ab>",
      linkKind: "invite",
    });

    expect(mail.html).toContain("Ama &lt;b&gt;x&lt;/b&gt;");
    expect(mail.html).toContain("&lt;ab&gt;");
    expect(mail.html).not.toContain("<b>x</b>");
  });
});
