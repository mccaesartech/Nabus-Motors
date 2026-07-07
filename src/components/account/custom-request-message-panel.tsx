"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOM_REQUEST_QUICK_MESSAGES } from "@/lib/custom-request/advice-quick-messages";
import { accountMessagesLink } from "@/lib/customer/notification-types";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { cn } from "@/lib/utils";

export type CustomRequestMessageContext = {
  requestId: string;
  referenceCode?: string | null;
  title: string;
};

type CustomRequestMessagePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: CustomRequestMessageContext;
  existingConversationId?: string | null;
};

export function CustomRequestMessagePanel({
  open,
  onOpenChange,
  context,
  existingConversationId,
}: CustomRequestMessagePanelProps) {
  const { getAccessToken } = useCustomerAuth();
  const [message, setMessage] = useState("");
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  function resetState() {
    setMessage("");
    setSelectedQuick(null);
    setError(null);
    setSuccessUrl(null);
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

    setSubmitting(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      const refPart = context.referenceCode ? ` (${context.referenceCode})` : "";
      const subject = `Vehicle request follow-up${refPart}: ${context.title.replace(/^Custom request — /, "")}`;

      const res = await fetch("/api/customer/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          existingConversationId
            ? { body: trimmed, conversationId: existingConversationId }
            : {
                body: trimmed,
                subject,
                category: "pre-order",
                preorderId: context.requestId,
              }
        ),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not send your message. Please try again.");
        return;
      }

      const conversationId = (json.conversationId as string | undefined) ?? existingConversationId ?? undefined;
      setSuccessUrl(accountMessagesLink(conversationId));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-brand-purple" />
            Message our team
          </DialogTitle>
          <DialogDescription>
            {context.referenceCode ? (
              <>
                About request <span className="font-mono font-medium">{context.referenceCode}</span>
              </>
            ) : (
              "Ask about your vehicle request — no need to wait for us to reach out first."
            )}
          </DialogDescription>
        </DialogHeader>

        {successUrl ? (
          <div className="space-y-4 py-2">
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Message sent. Our team will respond in your account messages.
            </p>
            <Button render={<Link href={successUrl} />} className="w-full">
              View conversation
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {existingConversationId && (
              <p className="text-xs text-muted-foreground">
                Continuing your existing conversation about this request.
              </p>
            )}

            <div className="space-y-2">
              <Label>Quick messages</Label>
              <div className="flex flex-wrap gap-2">
                {CUSTOM_REQUEST_QUICK_MESSAGES.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => selectQuickMessage(text)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-left text-xs transition-colors",
                      selectedQuick === text
                        ? "border-brand-purple bg-brand-purple/10 text-brand-purple"
                        : "border-border bg-muted/30 hover:border-brand-purple/40"
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr-message">Your message *</Label>
              <Textarea
                id="cr-message"
                rows={4}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setSelectedQuick(null);
                }}
                placeholder="Type your question or tap a quick message above…"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full gap-2">
              <Send className="size-4" />
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type CustomRequestMessageTriggerProps = {
  context: CustomRequestMessageContext;
  existingConversationId?: string | null;
  variant?: "default" | "outline";
  size?: "default" | "sm";
  className?: string;
};

export function CustomRequestMessageTrigger({
  context,
  existingConversationId,
  variant = "outline",
  size = "sm",
  className,
}: CustomRequestMessageTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-3.5" />
        Message our team
      </Button>
      <CustomRequestMessagePanel
        open={open}
        onOpenChange={setOpen}
        context={context}
        existingConversationId={existingConversationId}
      />
    </>
  );
}

export function CustomRequestBookVisitLink({ className }: { className?: string }) {
  return (
    <Button
      render={<Link href="#book-visit" />}
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
    >
      <CalendarCheck className="size-3.5" />
      Book a visit
    </Button>
  );
}
