"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountSettingsShell } from "@/components/account/account-settings-nav";
import { useRequireCustomerAuth } from "@/hooks/use-require-customer-auth";
import { useCustomerAuth } from "@/context/customer-auth-context";

type SessionRow = {
  id: string;
  browser: string | null;
  device: string | null;
  os: string | null;
  ip: string | null;
  country: string | null;
  last_active_at: string;
  current?: boolean;
};

type HistoryRow = {
  id: string;
  browser: string | null;
  device: string | null;
  os: string | null;
  ip: string | null;
  country: string | null;
  method: string;
  suspicious: boolean;
  created_at: string;
};

export default function AccountSecurityPage() {
  const { user, loading } = useRequireCustomerAuth();
  const { getAccessToken } = useCustomerAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    const headers = await authHeaders();
    const [sRes, hRes, mRes] = await Promise.all([
      fetch("/api/customer/sessions", { headers }),
      fetch("/api/customer/login-history", { headers }),
      fetch("/api/customer/mfa", { headers }),
    ]);
    const sBody = await sRes.json().catch(() => null);
    const hBody = await hRes.json().catch(() => null);
    const mBody = await mRes.json().catch(() => null);
    if (sBody?.sessions) setSessions(sBody.sessions);
    if (hBody?.history) setHistory(hBody.history);
    if (mBody) {
      setMfaEnabled(Boolean(mBody.enabled));
      setMfaEnforced(Boolean(mBody.enforced));
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, refresh]);

  async function revoke(sessionId?: string, all = false) {
    setBusy(true);
    setMessage("");
    const headers = await authHeaders();
    await fetch("/api/customer/sessions", {
      method: "DELETE",
      headers,
      body: JSON.stringify(all ? { all: true } : { sessionId }),
    });
    await refresh();
    setMessage(all ? "Other sessions signed out." : "Session revoked.");
    setBusy(false);
  }

  async function startMfa() {
    setBusy(true);
    setMessage("");
    const headers = await authHeaders();
    const res = await fetch("/api/customer/mfa", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "enroll" }),
    });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setEnrollSecret(body.secret);
      setQrUrl(body.qrUrl);
    } else {
      setMessage(body?.message || "Could not start MFA setup.");
    }
    setBusy(false);
  }

  async function confirmMfa() {
    setBusy(true);
    setMessage("");
    const headers = await authHeaders();
    const res = await fetch("/api/customer/mfa", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "confirm", code: mfaCode }),
    });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      setBackupCodes(body.backupCodes ?? null);
      setEnrollSecret(null);
      setQrUrl(null);
      setMfaCode("");
      setMessage(body.message || "MFA enabled.");
      await refresh();
    } else {
      setMessage(body?.message || "Could not confirm MFA.");
    }
    setBusy(false);
  }

  async function disableMfa() {
    setBusy(true);
    setMessage("");
    const headers = await authHeaders();
    const res = await fetch("/api/customer/mfa", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "disable", code: mfaCode }),
    });
    const body = await res.json().catch(() => null);
    setMessage(body?.message || (body?.ok ? "MFA disabled." : "Could not disable MFA."));
    if (body?.ok) {
      setMfaCode("");
      setBackupCodes(null);
      await refresh();
    }
    setBusy(false);
  }

  if (loading || !user) {
    return (
      <Container className="py-16 sm:py-20">
        <p className="text-sm text-muted-foreground">Loading security settings…</p>
      </Container>
    );
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <AccountSettingsShell
          title="Security"
          description="Sessions, login history, and authenticator MFA."
        >
          {message ? (
            <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              {message}
            </p>
          ) : null}

          <section className="space-y-3 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Authenticator (MFA)</h2>
            <p className="text-sm text-muted-foreground">
              {mfaEnabled
                ? "Authenticator app is enabled on your account."
                : "Add an authenticator app for an extra sign-in step."}
              {mfaEnforced ? " An administrator requires MFA for this account." : ""}
            </p>
            {!mfaEnabled && !enrollSecret ? (
              <Button type="button" onClick={() => void startMfa()} disabled={busy}>
                Set up authenticator
              </Button>
            ) : null}
            {enrollSecret ? (
              <div className="space-y-3">
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrUrl} alt="MFA QR code" className="size-48 rounded border" />
                ) : null}
                <p className="break-all text-xs text-muted-foreground">
                  Secret: {enrollSecret}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-confirm">Confirmation code</Label>
                  <Input
                    id="mfa-confirm"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                <Button type="button" onClick={() => void confirmMfa()} disabled={busy}>
                  Confirm and enable
                </Button>
              </div>
            ) : null}
            {mfaEnabled ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-disable">Code to disable MFA</Label>
                  <Input
                    id="mfa-disable"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void disableMfa()}
                  disabled={busy || mfaEnforced}
                >
                  Turn off MFA
                </Button>
              </div>
            ) : null}
            {backupCodes ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">Backup codes (save these now)</p>
                <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
                  {backupCodes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="mt-6 space-y-3 rounded-lg border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Active sessions</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void revoke(undefined, true)}
              >
                Sign out other devices
              </Button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tracked sessions yet. They appear after you sign in (requires database migration).
              </p>
            ) : (
              <ul className="divide-y">
                {sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {s.browser || "Browser"} · {s.device || "Device"} · {s.os || "OS"}
                        {s.current ? " (this device)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ip || "IP unknown"}
                        {s.country ? ` · ${s.country}` : ""} · Last active{" "}
                        {new Date(s.last_active_at).toLocaleString()}
                      </p>
                    </div>
                    {!s.current ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void revoke(s.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 space-y-3 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Login history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No login history yet. Successful sign-ins will appear here.
              </p>
            ) : (
              <ul className="divide-y">
                {history.map((h) => (
                  <li key={h.id} className="py-3 text-sm">
                    <p className="font-medium">
                      {h.method} · {h.browser || "Browser"} · {h.device || "Device"}
                      {h.suspicious ? " · Flagged" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                      {h.ip ? ` · ${h.ip}` : ""}
                      {h.country ? ` · ${h.country}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-6 text-sm">
            <Link href="/account/settings/privacy" className="text-brand-purple hover:underline">
              Privacy &amp; account deletion →
            </Link>
          </p>
        </AccountSettingsShell>
      </div>
    </Container>
  );
}
