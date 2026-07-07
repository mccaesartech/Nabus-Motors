"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LoggedInContactBanner,
  useFreightFormProfile,
} from "@/components/freight/freight-form-account-fields";
import { FREIGHT_ADVICE_QUICK_MESSAGES } from "@/lib/freight/advice-quick-messages";
import { accountMessagesLink } from "@/lib/customer/notification-types";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { cn } from "@/lib/utils";

export type FreightAdviceContext = {
  trackingNumber?: string | null;
  referenceCode?: string | null;
};

type FreightAdviceMessagePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: FreightAdviceContext;
};

export function FreightAdviceMessagePanel({
  open,
  onOpenChange,
  context,
}: FreightAdviceMessagePanelProps) {
  const { getAccessToken } = useCustomerAuth();
  const { name, setName, email, setEmail, phone, setPhone, isGuest } =
    useFreightFormProfile();

  const [message, setMessage] = useState("");
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ accountUrl: string } | null>(null);

  function resetState() {
    setMessage("");
    setSelectedQuick(null);
    setError(null);
    setSuccess(null);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  function selectQuickMessage(text: string) {
    setSelectedQuick(text);
    setMessage(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please enter a message or pick a quick question.");
      return;
    }

    if (isGuest) {
      if (!name.trim() || !email.trim()) {
        setError("Name and email are required.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const token = isGuest ? null : await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/inquiries/freight-advice", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: isGuest ? name.trim() : undefined,
          email: isGuest ? email.trim() : undefined,
          phone: isGuest ? phone.trim() || undefined : undefined,
          body: trimmed,
          trackingNumber: context?.trackingNumber ?? undefined,
          referenceCode: context?.referenceCode ?? undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not send your message. Please try again.");
        return;
      }

      const conversationId = json.conversationId as string | undefined;
      setSuccess({
        accountUrl: accountMessagesLink(conversationId),
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-var(--header-height)-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-brand-purple" />
            Personalised freight advice
          </DialogTitle>
          <DialogDescription>
            Ask our logistics team anything about your shipment, quote, or import. Pick a quick
            question or write your own message.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <p className="font-medium">Message sent</p>
            <p className="text-sm">
              Our freight team will reply in your account messages. You can also check back here
              for updates on your shipment.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={success.accountUrl}
                className="inline-flex items-center rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
              >
                View conversation
              </Link>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isGuest ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="advice-name">Full name *</Label>
                  <Input
                    id="advice-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="advice-email">Email *</Label>
                  <Input
                    id="advice-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="advice-phone">Phone</Label>
                  <Input
                    id="advice-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="Optional — helps us reach you faster"
                  />
                </div>
              </div>
            ) : (
              <LoggedInContactBanner name={name} email={email} phone={phone} />
            )}

            {(context?.trackingNumber || context?.referenceCode) && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                {context.trackingNumber && (
                  <p>
                    <span className="font-medium">Tracking:</span>{" "}
                    <span className="font-mono">{context.trackingNumber}</span>
                  </p>
                )}
                {context.referenceCode && (
                  <p className={context.trackingNumber ? "mt-1" : undefined}>
                    <span className="font-medium">Quote reference:</span>{" "}
                    <span className="font-mono">{context.referenceCode}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Quick questions</Label>
              <div className="flex flex-wrap gap-2">
                {FREIGHT_ADVICE_QUICK_MESSAGES.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => selectQuickMessage(text)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-sm",
                      selectedQuick === text
                        ? "border-brand-purple bg-brand-purple text-white shadow-sm"
                        : "border-brand-purple/25 bg-brand-purple/5 text-brand-purple hover:border-brand-purple/50 hover:bg-brand-purple/10"
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="advice-message">Your message *</Label>
              <Textarea
                id="advice-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setSelectedQuick(null);
                }}
                rows={4}
                required
                placeholder="Type your question or tap a quick message above…"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full gap-2 bg-brand-purple text-white hover:bg-brand-purple-dark sm:w-auto"
            >
              <Send className="size-4" />
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FreightAdviceTriggerProps = {
  context?: FreightAdviceContext;
  className?: string;
  children?: React.ReactNode;
  variant?: "default" | "outline";
};

export function FreightAdviceTrigger({
  context,
  className,
  children,
  variant = "default",
}: FreightAdviceTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant === "outline" ? "outline" : "default"}
        className={cn(
          variant === "default" &&
            "bg-brand-purple text-white hover:bg-brand-purple-dark",
          className
        )}
        onClick={() => setOpen(true)}
      >
        {children ?? (
          <>
            <MessageCircle className="size-4" />
            Personalised advice
          </>
        )}
      </Button>
      <FreightAdviceMessagePanel open={open} onOpenChange={setOpen} context={context} />
    </>
  );
}
