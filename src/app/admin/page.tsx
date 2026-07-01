"use client";

import { useState } from "react";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.message ?? "Login failed.");
      setLoading(false);
      return;
    }

    window.location.assign(data.redirect ?? "/platform/dashboard");
  }

  return (
    <AdminAuthShell>
      <div className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] p-5 shadow-lg sm:p-8">
        <h1 className="text-center text-xl font-semibold text-[var(--platform-text)]">
          Admin Portal
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--platform-text-secondary)]">
          Team members: enter your email and password. Owner: leave email blank and use the master password.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        >
            <div className="space-y-1.5">
              <Label htmlFor="admin-portal-email">Email (team members)</Label>
              <input
                id="admin-portal-email"
                name="admin-portal-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="platform-input w-full"
                placeholder="you@company.com (team members)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-portal-password">Password</Label>
              <PasswordInput
                id="admin-portal-password"
                name="admin-portal-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="platform-input"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
        </form>
      </div>
    </AdminAuthShell>
  );
}
