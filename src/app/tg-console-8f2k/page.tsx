"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminDashboardPath } from "@/lib/admin/paths";

export default function AdminLoginPage() {
  const router = useRouter();
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
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.message ?? "Login failed.");
      setLoading(false);
      return;
    }

    router.push(data.redirect ?? adminDashboardPath());
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-brand-black py-16">
      <Container className="max-w-md">
        <div className="border border-white/10 bg-brand-charcoal p-8 shadow-luxury-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-gold">
            True Goshen
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white">Admin Portal</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Private access only. Not linked from the public website.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-white">
                Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-white/20 bg-black/40 text-white"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>
      </Container>
    </div>
  );
}
