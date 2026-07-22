"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { useCustomerAuth } from "@/context/customer-auth-context";

export default function RestoreDeletionPage() {
  const router = useRouter();
  const { user, getAccessToken, signOut } = useCustomerAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  async function sendCode() {
    setError("");
    setSendingCode(true);

    const token = await getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/customer/deletion-verification", {
      method: "POST",
      headers,
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Could not send verification code.");
      setSendingCode(false);
      return;
    }

    setVerificationSent(true);
    setSendingCode(false);
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    const token = await getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/customer/cancel-deletion", {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: authMethod === "password" ? password : undefined,
        verificationToken: authMethod === "otp" ? verificationToken : undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Could not restore your account.");
      setSubmitting(false);
      return;
    }

    setSuccess("Your account deletion was cancelled. You can sign in again.");
    await signOut();
    setSubmitting(false);
    router.push("/login?restored=1");
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-lg space-y-6">
        <Link href="/" className="text-sm font-medium text-brand-purple hover:underline">
          ← Home
        </Link>

        <AccountSectionHeader
          icon={<RotateCcw className="size-5" />}
          title="Restore account"
          description="Cancel a pending account deletion during the retention period."
        />

        <p className="text-sm text-muted-foreground">
          If your account is scheduled for deletion, you can cancel it here before the retention
          period ends. Contact{" "}
          <a href="/contact" className="font-medium text-brand-purple hover:underline">
            support
          </a>{" "}
          if you need help.
        </p>

        <form onSubmit={(e) => void handleRestore(e)} className="space-y-4 rounded-lg border p-5">
          <div className="space-y-2">
            <Label htmlFor="restore-email">Account email</Label>
            <Input
              id="restore-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={Boolean(user?.email)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Verify identity</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={authMethod === "password" ? "default" : "outline"}
                onClick={() => setAuthMethod("password")}
              >
                Password
              </Button>
              <Button
                type="button"
                size="sm"
                variant={authMethod === "otp" ? "default" : "outline"}
                onClick={() => setAuthMethod("otp")}
              >
                Email code
              </Button>
            </div>
          </div>

          {authMethod === "password" ? (
            <div className="space-y-2">
              <Label htmlFor="restore-password">Password</Label>
              <Input
                id="restore-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 space-y-2">
                  <Label htmlFor="restore-otp">Verification code</Label>
                  <Input
                    id="restore-otp"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendingCode}
                  onClick={() => void sendCode()}
                >
                  {sendingCode ? "Sending…" : verificationSent ? "Resend" : "Send code"}
                </Button>
              </div>
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-green-700">{success}</p> : null}

          <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
            {submitting ? "Restoring…" : "Cancel deletion & restore account"}
          </Button>
        </form>
      </div>
    </Container>
  );
}
