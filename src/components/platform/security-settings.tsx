"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, Shield, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import {
  isBrowserWebAuthnAvailable,
  isWebAuthnFeatureEnabled,
  registerPasskey,
} from "@/lib/admin/webauthn-client";

type Passkey = {
  id: string;
  deviceName: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export function SecuritySettings({ forcedChange = false }: { forcedChange?: boolean }) {
  const featureEnabled = isWebAuthnFeatureEnabled();
  const webAuthnAvailable = isBrowserWebAuthnAvailable();

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);
  const [ownerAccount, setOwnerAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const showToast = useCallback((message: string, isError = false) => {
    setToast(message);
    setToastError(isError);
    setTimeout(() => setToast(""), 5000);
  }, []);

  const load = useCallback(async () => {
    if (!featureEnabled || forcedChange) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/passkeys", { credentials: "same-origin" });
    const json = await res.json();
    if (res.ok && json.ok) {
      setPasskeys(json.passkeys ?? []);
      setBackupCodesRemaining(json.backupCodesRemaining ?? 0);
      setOwnerAccount(Boolean(json.ownerAccount));
    }
    setLoading(false);
  }, [featureEnabled, forcedChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddPasskey() {
    if (!webAuthnAvailable) {
      showToast("Passkeys are not supported in this browser.", true);
      return;
    }

    setBusy(true);
    try {
      const result = await registerPasskey(deviceName);
      if (result.ok) {
        showToast(result.message);
        setDeviceName("");
        await load();
      } else {
        showToast(result.message, true);
      }
    } catch {
      showToast("Passkey registration was cancelled or failed.", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemovePasskey(id: string) {
    if (!confirm("Remove this passkey? You will need another sign-in method.")) return;

    setBusy(true);
    const res = await fetch(`/api/admin/passkeys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const json = await res.json();
    setBusy(false);

    if (res.ok && json.ok) {
      showToast("Passkey removed.");
      await load();
    } else {
      showToast(json.message ?? "Could not remove passkey.", true);
    }
  }

  async function handleGenerateBackupCodes() {
    if (
      !confirm(
        "Generate new backup codes? Any unused codes will be replaced. Save the new codes immediately — they are shown only once."
      )
    ) {
      return;
    }

    setBusy(true);
    const res = await fetch("/api/admin/backup-codes/generate", {
      method: "POST",
      credentials: "same-origin",
    });
    const json = await res.json();
    setBusy(false);

    if (res.ok && json.ok && Array.isArray(json.codes)) {
      setGeneratedCodes(json.codes);
      setBackupCodesRemaining(json.codes.length);
      showToast("Backup codes generated. Download or copy them now.");
    } else {
      showToast(json.message ?? "Could not generate backup codes.", true);
    }
  }

  function downloadBackupCodes() {
    if (!generatedCodes?.length) return;
    const text = [
      "Nabus Motors Admin — backup recovery codes",
      "Each code works once. Store securely.",
      "",
      ...generatedCodes,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nabus-motors-admin-backup-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.", true);
      return;
    }
    if (currentPassword === newPassword) {
      showToast("New password must be different from your current password.", true);
      return;
    }

    setPasswordBusy(true);
    let json: { ok?: boolean; message?: string; redirect?: string } = {};
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      json = await res.json().catch(() => ({}));
      setPasswordBusy(false);

      if (res.ok && json.ok === true) {
        if (forcedChange && typeof json.redirect === "string") {
          window.location.replace(json.redirect);
          return;
        }
        showToast(json.message ?? "Password updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        showToast(json.message ?? "Could not change password.", true);
      }
    } catch {
      setPasswordBusy(false);
      showToast("Could not change password. Check your connection and try again.", true);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading security settings…</p>;
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toastError
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          }`}
        >
          {toast}
        </div>
      ) : null}

      {!ownerAccount ? (
        <form onSubmit={handleChangePassword} className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--platform-text)]">
            {forcedChange ? "Choose your new password" : "Change password"}
          </h3>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
              Current password
            </span>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="platform-input w-full"
              autoComplete="current-password"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
              New password
            </span>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
              className="platform-input w-full"
              autoComplete="new-password"
            />
            <span className="block text-[11px] text-[var(--platform-text-secondary)]">
              At least 10 characters with uppercase, lowercase, and a number. Must differ from your
              current password.
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
              Confirm new password
            </span>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              className="platform-input w-full"
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={passwordBusy} className="platform-btn-secondary">
            <KeyRound className="size-4" />
            {passwordBusy
              ? "Updating…"
              : forcedChange
                ? "Save password and continue"
                : "Update password"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--platform-text-secondary)]">
          The bootstrap owner account uses the master password from server configuration. Passkeys and
          password change are available for invited team accounts only.
        </p>
      )}

      {featureEnabled && !ownerAccount && !forcedChange ? (
        <div className="space-y-4 border-t border-[var(--platform-border)] pt-4">
          <div className="flex items-start gap-3">
            <Fingerprint className="mt-0.5 size-5 shrink-0 text-[var(--platform-accent)]" />
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-[var(--platform-text)]">Passkeys</h3>
              <p className="text-xs text-[var(--platform-text-secondary)]">
                Sign in with your fingerprint, face, or device PIN. Works alongside your password.
              </p>
            </div>
          </div>

          {!webAuthnAvailable ? (
            <p className="text-sm text-amber-800">
              This browser does not support passkeys. Try Chrome, Safari, or Edge on a supported device.
            </p>
          ) : null}

          {passkeys.length > 0 ? (
            <ul className="space-y-2">
              {passkeys.map((pk) => (
                <li
                  key={pk.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--platform-border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--platform-text)]">
                      {pk.deviceName || "Unnamed device"}
                    </p>
                    <p className="text-xs text-[var(--platform-text-secondary)]">
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                      {pk.lastUsedAt
                        ? ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemovePasskey(pk.id)}
                    disabled={busy}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                    aria-label="Remove passkey"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--platform-text-secondary)]">No passkeys registered yet.</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 space-y-1.5">
              <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                Device name (optional)
              </span>
              <input
                className="platform-input w-full"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. MacBook Pro, iPhone"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleAddPasskey()}
              disabled={busy || !webAuthnAvailable}
              className="platform-btn-primary shrink-0"
            >
              <Fingerprint className="size-4" />
              {busy ? "Waiting for device…" : "Add passkey"}
            </button>
          </div>

          <div className="space-y-3 border-t border-[var(--platform-border)] pt-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 size-5 shrink-0 text-[var(--platform-accent)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--platform-text)]">Backup recovery codes</h3>
                <p className="text-xs text-[var(--platform-text-secondary)]">
                  One-time codes if you lose access to your passkey device.{" "}
                  {backupCodesRemaining > 0
                    ? `${backupCodesRemaining} unused code${backupCodesRemaining === 1 ? "" : "s"} remaining.`
                    : "None generated yet."}
                </p>
              </div>
            </div>

            {generatedCodes ? (
              <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-950">
                  Save these codes now — they will not be shown again.
                </p>
                <ul className="mt-3 grid gap-1 font-mono text-sm text-amber-950 sm:grid-cols-2">
                  {generatedCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={downloadBackupCodes} className="platform-btn-secondary text-xs">
                    Download codes
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratedCodes(null)}
                    className="platform-btn-ghost text-xs"
                  >
                    I saved them
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleGenerateBackupCodes()}
              disabled={busy}
              className="platform-btn-secondary"
            >
              {backupCodesRemaining > 0 ? "Regenerate backup codes" : "Generate backup codes"}
            </button>
          </div>
        </div>
      ) : featureEnabled && ownerAccount ? (
        <p className="text-sm text-[var(--platform-text-secondary)]">
          Passkeys are not available for the bootstrap owner account. Team members can register passkeys
          after accepting their invite.
        </p>
      ) : null}
    </div>
  );
}
