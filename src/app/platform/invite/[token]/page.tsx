"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/platform/permissions";
import { adminDashboardPath, adminLoginPath } from "@/lib/admin/paths";

type InviteInfo = {
  name: string;
  email: string;
  role: string;
};

export default function AcceptInvitePage() {
  const params = useParams();
  const token = String(params.token ?? "");

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const validate = useCallback(async () => {
    const res = await fetch(`/api/admin/invite/validate?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Invalid invitation.");
      setLoading(false);
      return;
    }
    setInvite(json.invite);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    validate();
  }, [validate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/admin/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        token,
        password,
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
      }),
    });
    const json = await res.json();

    if (!res.ok || !json.ok) {
      setError(json.message ?? "Activation failed.");
      setSubmitting(false);
      return;
    }

    setRedirecting(true);
    window.location.assign(json.redirect ?? adminDashboardPath());
  }

  return (
    <AdminAuthShell>
      <div className="w-full rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] p-5 shadow-lg sm:p-8">
        <h1 className="text-center text-xl font-semibold text-[var(--platform-text)]">
          Accept invitation
        </h1>

        {loading && (
          <p className="mt-6 text-center text-sm text-[var(--platform-text-secondary)]">
            Verifying invitation…
          </p>
        )}

        {!loading && error && !invite && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Link href={adminLoginPath()} className="text-sm text-[var(--platform-accent)] hover:underline">
              Go to sign in
            </Link>
          </div>
        )}

        {!loading && invite && (
          <>
            <p className="mt-2 text-center text-sm text-[var(--platform-text-secondary)]">
              Welcome, {invite.name}. Set your password to activate your{" "}
              {ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS] ?? invite.role} account.
            </p>
            <p className="mt-1 text-center text-xs text-[var(--platform-text-secondary)]">
              {invite.email}
            </p>

            {redirecting ? (
              <div className="mt-6 flex flex-col items-center gap-3 text-center">
                <Loader2 className="size-6 animate-spin text-[var(--platform-accent)]" />
                <p className="text-sm text-[var(--platform-text-secondary)]">
                  Account activated. Opening your dashboard…
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-password">Password</Label>
                  <PasswordInput
                    id="invite-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="platform-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-confirm">Confirm password</Label>
                  <PasswordInput
                    id="invite-confirm"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="platform-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-phone">Phone (optional)</Label>
                  <input
                    id="invite-phone"
                    className="platform-input w-full"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-title">Job title (optional)</Label>
                  <input
                    id="invite-title"
                    className="platform-input w-full"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting || redirecting}>
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Activating…
                    </span>
                  ) : (
                    "Activate account"
                  )}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </AdminAuthShell>
  );
}
