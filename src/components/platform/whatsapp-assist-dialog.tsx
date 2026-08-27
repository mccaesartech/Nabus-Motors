"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Loader2, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isAdminAuthError } from "@/lib/admin/client";
import { adminLoginPath } from "@/lib/admin/paths";
import { useRouter } from "next/navigation";
import type { WhatsAppAssistContextType } from "@/lib/whatsapp-assist/types";

export type WhatsAppAssistContext = {
  type?: WhatsAppAssistContextType;
  id?: string;
  inquiryType?: string;
  customerId?: string;
  userId?: string;
  email?: string;
};

type WhatsAppAssistDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  customerName?: string;
  context?: WhatsAppAssistContext;
};

type SuggestState = {
  contextSummary: string;
  followUpReason: string;
  suggestedMessage: string;
  missingFields: string[];
  needsClarification: boolean;
  configured: boolean;
};

export function WhatsAppAssistDialog({
  open,
  onOpenChange,
  phone,
  customerName,
  context,
}: WhatsAppAssistDialogProps) {
  const router = useRouter();
  const customerReplyId = useId();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [scratchMode, setScratchMode] = useState(false);
  const [message, setMessage] = useState("");
  const [lastCustomerMessage, setLastCustomerMessage] = useState("");
  const [staffInstructions, setStaffInstructions] = useState("");
  const [suggest, setSuggest] = useState<SuggestState | null>(null);

  const buildSuggestBody = useCallback(
    (mode: "initial" | "reply") => ({
      phone,
      customerName,
      customerId: context?.customerId,
      userId: context?.userId,
      email: context?.email,
      contextType: context?.type,
      contextId: context?.id,
      inquiryType: context?.inquiryType,
      mode,
      lastCustomerMessage: mode === "reply" ? lastCustomerMessage : undefined,
      staffInstructions: staffInstructions.trim() || undefined,
    }),
    [
      phone,
      customerName,
      context?.customerId,
      context?.userId,
      context?.email,
      context?.type,
      context?.id,
      context?.inquiryType,
      lastCustomerMessage,
      staffInstructions,
    ]
  );

  const fetchSuggestion = useCallback(
    async (mode: "initial" | "reply" = "initial") => {
      setLoading(true);
      setError(null);
      setSendNotice(null);

      const res = await fetch("/api/admin/customer-messages/whatsapp/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSuggestBody(mode)),
      });

      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not generate suggestion.");
        setLoading(false);
        return;
      }

      setSuggest({
        contextSummary: String(json.contextSummary ?? ""),
        followUpReason: String(json.followUpReason ?? ""),
        suggestedMessage: String(json.suggestedMessage ?? ""),
        missingFields: Array.isArray(json.missingFields) ? json.missingFields : [],
        needsClarification: Boolean(json.needsClarification),
        configured: Boolean(json.configured),
      });

      if (!scratchMode) {
        setMessage(String(json.suggestedMessage ?? ""));
      }

      setLoading(false);
    },
    [buildSuggestBody, router, scratchMode]
  );

  useEffect(() => {
    if (!open) {
      setError(null);
      setSendNotice(null);
      setScratchMode(false);
      setMessage("");
      setLastCustomerMessage("");
      setStaffInstructions("");
      setSuggest(null);
      return;
    }
    void fetchSuggestion("initial");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegenerate() {
    const mode = lastCustomerMessage.trim() ? "reply" : "initial";
    await fetchSuggestion(mode);
  }

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Enter a message before sending.");
      return;
    }

    setSending(true);
    setError(null);
    setSendNotice(null);

    const res = await fetch("/api/admin/customer-messages/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        message: trimmed,
        customerName,
        customerId: context?.customerId,
        userId: context?.userId,
        email: context?.email,
        contextType: context?.type,
        contextId: context?.id,
      }),
    });

    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }

    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not send message.");
      setSending(false);
      return;
    }

    if (json.method === "wa_me" && json.waMeUrl) {
      window.open(String(json.waMeUrl), "_blank", "noopener,noreferrer");
      setSendNotice(
        json.reason
          ? `WhatsApp API unavailable — opened WhatsApp Web with your message. (${json.reason})`
          : "Opened WhatsApp Web with your message. Send it from there to complete delivery."
      );
    } else if (json.sent) {
      setSendNotice("Message sent.");
      onOpenChange(false);
    } else {
      setSendNotice("Message logged. Complete sending in WhatsApp if prompted.");
    }

    setSending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-[var(--platform-accent,#8b5cf6)]" />
            Contact Customer via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Review the AI suggestion, edit as needed, then send. Nothing is sent until you click Send.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
          <div className="rounded-lg border border-[var(--platform-border,#e5e7eb)] bg-[rgba(139,92,246,0.04)] p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
              Customer
            </p>
            <p className="mt-1 font-medium">
              {customerName ?? "Customer"} · {phone}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--platform-text-secondary,#6b7280)]">
              <Loader2 className="size-4 animate-spin" />
              Analyzing customer records…
            </div>
          ) : suggest ? (
            <>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
                    Context
                  </p>
                  <p className="mt-1 text-[var(--platform-text,#111827)]">{suggest.contextSummary}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
                    Follow-up reason
                  </p>
                  <p className="mt-1 text-[var(--platform-text,#111827)]">{suggest.followUpReason}</p>
                </div>
                {suggest.missingFields.length > 0 ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">Needs clarification</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-amber-900">
                      {suggest.missingFields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!suggest.configured ? (
                  <p className="text-xs text-[var(--platform-text-secondary,#6b7280)]">
                    Gemini is not configured — using a basic template. Add GEMINI_API_KEY for smarter
                    suggestions.
                  </p>
                ) : null}
              </div>

              {!scratchMode && suggest.suggestedMessage ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
                    AI suggestion
                  </p>
                  <p className="rounded-md border border-[var(--platform-border,#e5e7eb)] bg-white/80 p-3 text-sm whitespace-pre-wrap">
                    {suggest.suggestedMessage}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="wa-assist-message" className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
                Message to send
              </label>
              <button
                type="button"
                className="text-xs text-[var(--platform-accent,#8b5cf6)] hover:underline"
                onClick={() => {
                  setScratchMode((v) => !v);
                  if (!scratchMode) setMessage("");
                }}
              >
                {scratchMode ? "Use AI suggestion" : "Write from scratch"}
              </button>
            </div>
            <Textarea
              id="wa-assist-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Edit the suggested message or write your own…"
              className="min-h-[8rem] resize-y"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={customerReplyId} className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
              Customer&apos;s latest reply (optional)
            </label>
            <Textarea
              id={customerReplyId}
              value={lastCustomerMessage}
              onChange={(e) => setLastCustomerMessage(e.target.value)}
              rows={2}
              placeholder="Paste the customer's WhatsApp reply to get a suggested response…"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="wa-assist-instructions" className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary,#6b7280)]">
              Regenerate instructions (optional)
            </label>
            <Textarea
              id="wa-assist-instructions"
              value={staffInstructions}
              onChange={(e) => setStaffInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Mention shipment is at port, ask for preferred pickup time…"
            />
          </div>

          {error ? (
            <p className="text-sm text-[var(--platform-error,#dc2626)]" role="alert">
              {error}
            </p>
          ) : null}
          {sendNotice ? (
            <p className="text-sm text-[var(--platform-success,#059669)]" role="status">
              {sendNotice}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mt-2 gap-2 border-t border-[var(--platform-border,#e5e7eb)] pt-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRegenerate()}
              disabled={loading || sending}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Regenerate
            </Button>
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={loading || sending || !message.trim()}
              className={cn("gap-2")}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Send
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type WhatsAppAssistActionProps = {
  phone: string;
  customerName?: string;
  context?: WhatsAppAssistContext;
  variant?: "button" | "link";
  className?: string;
};

export function WhatsAppAssistAction({
  phone,
  customerName,
  context,
  variant = "button",
  className,
}: WhatsAppAssistActionProps) {
  const [open, setOpen] = useState(false);

  if (variant === "link") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline",
            className
          )}
        >
          <MessageCircle className="size-3" />
          WhatsApp
        </button>
        <WhatsAppAssistDialog
          open={open}
          onOpenChange={setOpen}
          phone={phone}
          customerName={customerName}
          context={context}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("platform-btn-ghost inline-flex items-center gap-2", className)}
      >
        <MessageCircle className="size-4" />
        Contact Customer via WhatsApp
      </button>
      <WhatsAppAssistDialog
        open={open}
        onOpenChange={setOpen}
        phone={phone}
        customerName={customerName}
        context={context}
      />
    </>
  );
}
