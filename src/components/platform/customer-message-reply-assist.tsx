"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AiFieldActions } from "@/components/platform/ai-field-actions";
import {
  CUSTOMER_REPLY_INTENTS,
  type CustomerReplyIntent,
} from "@/lib/ai/customer-reply-ai";
import type { CustomerConversation } from "@/lib/customer/types";

type CustomerMessageReplyAssistProps = {
  conversation: CustomerConversation;
  customerBody: string;
  draft: string;
  onApplyDraft: (text: string) => void;
};

export function CustomerMessageReplyAssist({
  conversation,
  customerBody,
  draft,
  onApplyDraft,
}: CustomerMessageReplyAssistProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  const hasDraft = Boolean(draft.trim());

  function applyDraft(next: string) {
    setUndoValue(draft);
    onApplyDraft(next);
  }

  function handleUndo() {
    if (undoValue === null) return;
    onApplyDraft(undoValue);
    setUndoValue(null);
  }

  async function requestDraft(intent: CustomerReplyIntent, prompt?: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/customer-messages/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: conversation.customer_name,
          email: conversation.customer_email,
          subject: conversation.subject,
          body: customerBody,
          category: conversation.category,
          intent,
          customPrompt: prompt,
          existingDraft: draft.trim() || undefined,
        }),
      });

      const json = await res.json();
      setConfigured(json.configured !== false);

      if (!res.ok) {
        setError(json.message ?? "AI assist unavailable.");
        return;
      }

      if (json.draft) {
        applyDraft(json.draft);
        setShowCustomPrompt(false);
      }
    } catch {
      setError("Could not reach AI assist. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platform-ai-panel space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--platform-ai-accent,#7c3aed)]" />
          <p className="text-sm font-semibold text-[var(--platform-ai-text,#3b0764)]">
            Help me phrase a reply
          </p>
        </div>
        <AiFieldActions
          className="ml-auto"
          loading={loading}
          hasText={hasDraft}
          onImprove={() => void requestDraft("custom", "Improve my draft reply — keep facts accurate, warmer and clearer.")}
          onDraft={hasDraft ? undefined : () => setShowCustomPrompt((open) => !open)}
          canUndo={undoValue !== null}
          onUndo={handleUndo}
          improveLabel="✨ Improve reply"
          draftLabel="✨ Draft reply"
        />
      </div>

      <p className="text-xs text-[var(--platform-ai-text-secondary,#6b21a8)]">
        {hasDraft
          ? "AI polishes the text in your reply box — no copy-paste needed. Or pick a quick intent below to rewrite."
          : "Pick a quick intent — AI writes directly into your reply box below."}
      </p>

      <div className="flex flex-wrap gap-2">
        {CUSTOMER_REPLY_INTENTS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={loading}
            onClick={() => void requestDraft(chip.id)}
            className="platform-ai-chip"
            title={chip.hint}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowCustomPrompt((open) => !open)}
          className="platform-ai-chip"
        >
          Custom instructions
        </button>
      </div>

      {showCustomPrompt && (
        <div className="space-y-2">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            className="platform-ai-textarea"
            placeholder="Tell AI what to write in your reply box — e.g. “Thank them and ask for their preferred pickup date”"
          />
          <button
            type="button"
            disabled={loading || !customPrompt.trim()}
            onClick={() => void requestDraft("custom", customPrompt.trim())}
            className="platform-ai-btn"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Drafting…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Write into reply
              </>
            )}
          </button>
        </div>
      )}

      {configured === false && (
        <p className="text-xs text-amber-800">
          Add <code className="rounded bg-white/60 px-1">GEMINI_API_KEY</code> in Vercel to
          enable AI reply assist. You can still type replies manually.
        </p>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
