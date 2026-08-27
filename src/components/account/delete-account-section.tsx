"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { useCustomerAuth } from "@/context/customer-auth-context";
import {
  DELETION_REASON_LABELS,
  DELETION_REASONS,
  type DeletionReason,
} from "@/lib/customer/account-lifecycle.shared";

const REMOVED_IMMEDIATELY = [
  "Profile photo and personal settings",
  "Saved searches, wishlist, and saved vehicles",
  "Cart, notifications, and marketing preferences",
  "Messages and support conversations",
  "Device sessions and authentication tokens",
];

const RETAINED_ANONYMIZED = [
  "Vehicle purchases, invoices, and receipts",
  "Payments and shipment tracking",
  "Freight requests and appointments",
  "Audit logs and business communications",
];

type DeleteAccountSectionProps = {
  retentionDays?: number;
};

export function DeleteAccountSection({ retentionDays = 30 }: DeleteAccountSectionProps) {
  const router = useRouter();
  const { user, getAccessToken, signOut } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [reason, setReason] = useState<DeletionReason | "">("");
  const [feedbackText, setFeedbackText] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const email = user?.email ?? "";
  const canConfirm =
    confirmation.trim() === "DELETE" ||
    confirmation.trim().toLowerCase() === email.toLowerCase();

  const canVerify =
    authMethod === "password" ? password.trim().length >= 6 : verificationToken.trim().length >= 6;

  async function sendVerificationCode() {
    setError("");
    setInfo("");
    setSendingCode(true);

    const token = await getAccessToken();
    if (!token) {
      setError("Your session expired. Please sign in again.");
      setSendingCode(false);
      return;
    }

    let json: { ok?: boolean; message?: string; reason?: string } = {};
    try {
      const res = await fetch("/api/customer/deletion-verification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      json = (await res.json().catch(() => ({}))) as typeof json;
      if (!res.ok) {
        setError(
          json.message ??
            (res.status === 429
              ? "Too many verification requests. Please try again later."
              : "Could not send verification code.")
        );
        setSendingCode(false);
        return;
      }
    } catch {
      setError("Network error while sending the verification code. Please try again.");
      setSendingCode(false);
      return;
    }

    setVerificationSent(true);
    setInfo(
      json.message ??
        "A 6-digit code was sent to your email. Check inbox and spam."
    );
    setSendingCode(false);
  }

  async function handleDelete() {
    if (!canConfirm || !canVerify) return;

    setError("");
    setSubmitting(true);

    const token = await getAccessToken();
    if (!token) {
      setError("Your session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/customer/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        confirmation,
        password: authMethod === "password" ? password : undefined,
        verificationToken: authMethod === "otp" ? verificationToken : undefined,
        reason: reason || undefined,
        feedbackText: feedbackText || undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Could not schedule account deletion. Please try again.");
      setSubmitting(false);
      return;
    }

    await signOut();
    setOpen(false);
    router.push(`/?account_deletion_scheduled=1&days=${retentionDays}`);
    router.refresh();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submitting) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmation("");
      setPassword("");
      setVerificationToken("");
      setVerificationSent(false);
      setError("");
      setInfo("");
    }
  }

  return (
    <section
      id="delete-account"
      className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-6 rounded-lg border border-destructive/20 bg-destructive/5 p-5"
    >
      <AccountSectionHeader
        icon={<AlertTriangle className="size-5 text-destructive" />}
        title="Delete account"
        description="Schedule permanent anonymization of your account after a retention period."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border bg-background/60 p-4">
          <p className="text-sm font-medium text-foreground">Removed immediately</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {REMOVED_IMMEDIATELY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 rounded-md border border-border bg-background/60 p-4">
          <p className="text-sm font-medium text-foreground">Retained (anonymized)</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {RETAINED_ANONYMIZED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Retention period: {retentionDays} days</p>
        <p className="mt-1">
          Your login is deactivated immediately. During the {retentionDays}-day retention period
          your account is hidden and recoverable via support or{" "}
          <span className="font-medium">/account/restore-deletion</span>. After retention expires,
          deletion cannot be undone.
        </p>
      </div>

      <Button
        type="button"
        variant="destructive"
        className="min-h-11"
        onClick={() => setOpen(true)}
      >
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Re-authentication is required. Personal data is removed immediately; business records
              are anonymized after {retentionDays} days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-reason">Why are you leaving? (optional)</Label>
              <select
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as DeletionReason | "")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="">Select a reason…</option>
                {DELETION_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {DELETION_REASON_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-feedback">Additional feedback (optional)</Label>
              <Textarea
                id="delete-feedback"
                rows={2}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                disabled={submitting}
                placeholder="Tell us how we could improve"
              />
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Verify your identity</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={authMethod === "password" ? "default" : "outline"}
                  onClick={() => setAuthMethod("password")}
                  disabled={submitting}
                >
                  Password
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={authMethod === "otp" ? "default" : "outline"}
                  onClick={() => setAuthMethod("otp")}
                  disabled={submitting}
                >
                  Email code
                </Button>
              </div>

              {authMethod === "password" ? (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="delete-password">Current password</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={submitting}
                  />
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[12rem] flex-1 space-y-2">
                      <Label htmlFor="delete-otp">Verification code</Label>
                      <Input
                        id="delete-otp"
                        value={verificationToken}
                        onChange={(e) => setVerificationToken(e.target.value)}
                        placeholder="6-digit code"
                        autoComplete="one-time-code"
                        disabled={submitting}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      disabled={sendingCode || submitting}
                      onClick={() => void sendVerificationCode()}
                    >
                      <Mail className="mr-1.5 size-4" />
                      {sendingCode ? "Sending…" : verificationSent ? "Resend code" : "Send code"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-medium text-foreground">{email}</span> or{" "}
                <span className="font-mono font-medium text-foreground">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={email || "DELETE"}
                autoComplete="off"
                disabled={submitting}
              />
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              You will be signed out immediately. Recovery is only possible during the retention
              period.
            </p>
          </div>

          {info && !error ? <p className="text-sm text-foreground">{info}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canConfirm || !canVerify || submitting}
              onClick={() => void handleDelete()}
            >
              {submitting ? "Scheduling deletion…" : "Confirm account deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
