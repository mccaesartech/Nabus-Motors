"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NabusAuthSplitShell } from "@/components/nabus/nabus-auth-split-shell";
import { WHATSAPP_NUMBER, whatsappUrl } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const payload =
      mode === "email" ? { email: email.trim() } : { phone: phone.trim() };

    try {
      const res = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 400 || res.status === 403 || res.status === 500) {
        setError(json.message ?? "Could not send reset instructions.");
        setLoading(false);
        return;
      }

      setMessage(
        json.message ??
          "If an account exists with that email or phone, we've sent password reset instructions."
      );
    } catch {
      setError("Could not send reset instructions. Please try again.");
    }

    setLoading(false);
  }

  return (
    <NabusAuthSplitShell
      panelTitle="Account recovery"
      panelBody="We'll send a secure reset link — never your password. Need help? Our team is on WhatsApp."
    >
      <h1 className="text-2xl font-bold text-[var(--nabus-charcoal)]">Forgot password</h1>
      <p className="mt-2 text-sm text-[var(--nabus-text-secondary)]">
        Enter the email or phone number on your account.
      </p>
      <p className="mt-4 rounded-lg border border-[var(--nabus-border)] bg-[var(--nabus-paper)] px-4 py-3 text-sm text-[var(--nabus-graphite)]">
        Need help right away?{" "}
        <a
          href={whatsappUrl(
            "Hi, I need help resetting my Nabus Motors account password.",
            WHATSAPP_NUMBER
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-[var(--nabus-primary)] hover:underline"
        >
          <MessageCircle className="size-4" />
          WhatsApp us
        </a>
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            mode === "email"
              ? "bg-[var(--nabus-primary)] text-white"
              : "bg-[var(--nabus-paper)] text-[var(--nabus-muted)]"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMode("phone")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            mode === "phone"
              ? "bg-[var(--nabus-primary)] text-white"
              : "bg-[var(--nabus-paper)] text-[var(--nabus-muted)]"
          }`}
        >
          Phone
        </button>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        {mode === "email" ? (
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-lg border-[var(--nabus-input-border)]"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="forgot-phone">Phone number</Label>
            <Input
              id="forgot-phone"
              type="tel"
              autoComplete="tel"
              placeholder="e.g. 024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="h-11 rounded-lg border-[var(--nabus-input-border)]"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </p>
        )}

        <Button
          type="submit"
          className="h-11 w-full rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)]"
          size="lg"
          disabled={loading}
        >
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--nabus-text-secondary)] lg:text-left">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-[var(--nabus-primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </NabusAuthSplitShell>
  );
}
