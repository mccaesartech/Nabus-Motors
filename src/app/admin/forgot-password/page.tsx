"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { adminLoginPath } from "@/lib/admin/paths";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 400) {
        setError(json.message ?? "Enter a valid email address.");
        setLoading(false);
        return;
      }

      if (res.status === 403) {
        setError(json.message ?? "This request could not be verified. Refresh and try again.");
        setLoading(false);
        return;
      }

      setMessage(
        json.message ??
          "If a team account exists for that email, we've sent password reset instructions."
      );
    } catch {
      setError("Could not send reset instructions. Please try again.");
    }

    setLoading(false);
  }

  return (
    <AdminAuthShell>
      <div className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] p-5 shadow-lg sm:p-8">
        <h1 className="text-center text-xl font-semibold text-[var(--platform-text)]">
          Forgot password
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--platform-text-secondary)]">
          Enter your team email. We&apos;ll send a one-time reset link by email
          {` `}and SMS when a phone number is on file. Owner master-password accounts
          cannot use this form.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="admin-forgot-email">Email</Label>
            <input
              id="admin-forgot-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="platform-input w-full"
              placeholder="you@company.com"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--platform-text-secondary)]">
          Remember your password?{" "}
          <Link
            href={adminLoginPath()}
            className="font-medium text-[var(--platform-accent)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AdminAuthShell>
  );
}
