"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { AiFieldActions } from "@/components/platform/ai-field-actions";
import {
  CUSTOMER_NOTE_INTENTS,
  type CustomerNoteFieldType,
  type CustomerNoteIntent,
} from "@/lib/ai/customer-note-ai";

export type CustomerNoteAiContext = {
  fieldType: CustomerNoteFieldType;
  status?: string;
  customerName?: string;
  trackingNumber?: string;
  originCountry?: string;
  destination?: string;
  estimatedArrival?: string;
  vesselName?: string;
  containerNumber?: string;
  eventTitle?: string;
  eventLocation?: string;
  serviceType?: string;
  cargoDescription?: string;
  customerMessage?: string;
  timelineEvents?: Array<{
    title: string;
    description?: string | null;
    location?: string | null;
    event_at?: string;
  }>;
};

type CustomerVisibleNoteFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  /** @deprecated Use `hint` instead */
  compactHelp?: boolean;
  aiContext: CustomerNoteAiContext;
  showAi?: boolean;
  /** Last saved/sent value — enables draft indicator and Send button when `onSend` is set */
  savedValue?: string;
  onSend?: () => void | Promise<void>;
  sending?: boolean;
  sendLabel?: string;
};

export function CustomerVisibleNoteField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  compactHelp = false,
  aiContext,
  showAi = true,
  savedValue,
  onSend,
  sending = false,
  sendLabel = "Send to customer",
}: CustomerVisibleNoteFieldProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [draftOptionsOpen, setDraftOptionsOpen] = useState(false);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);

  const hintText =
    hint ??
    (compactHelp
      ? "Plain-language update customers see on tracking — keep it short and professional."
      : undefined);

  const baseline = savedValue ?? "";
  const hasUnsavedDraft = onSend !== undefined && value !== baseline;
  const hasText = Boolean(value.trim());

  useEffect(() => {
    if (!showSent) return;
    const timer = window.setTimeout(() => setShowSent(false), 4000);
    return () => window.clearTimeout(timer);
  }, [showSent]);

  function applyAiResult(next: string) {
    setUndoValue(value);
    onChange(next);
  }

  function handleUndo() {
    if (undoValue === null) return;
    onChange(undoValue);
    setUndoValue(null);
  }

  async function requestDraft(
    mode: "draft" | "improve",
    intent: CustomerNoteIntent = "custom"
  ) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ai/customer-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...aiContext,
          mode,
          intent,
          bulletPoints: extraInstructions.trim() || undefined,
          existingDraft: value.trim() || undefined,
        }),
      });

      const json = await res.json();
      setConfigured(json.configured !== false);

      if (!res.ok) {
        setError(json.message ?? "AI assist unavailable.");
        return;
      }

      if (json.draft) {
        applyAiResult(json.draft);
        setDraftOptionsOpen(false);
      }
    } catch {
      setError("Could not reach AI assist. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!onSend || sending || !hasUnsavedDraft) return;
    try {
      await onSend();
      setShowSent(true);
      setUndoValue(null);
    } catch {
      // Parent handles error feedback (toast, etc.)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--platform-text-secondary)]">{label}</span>
        {hasUnsavedDraft && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
            Unsaved draft
          </span>
        )}
        {showSent && !hasUnsavedDraft && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-medium text-[var(--platform-success)]">
            <Check className="size-3" />
            Sent
          </span>
        )}
        {showAi && (
          <AiFieldActions
            className="ml-auto"
            loading={loading}
            hasText={hasText}
            onImprove={() => void requestDraft("improve")}
            onDraft={hasText ? undefined : () => setDraftOptionsOpen((open) => !open)}
            canUndo={undoValue !== null}
            onUndo={handleUndo}
            improveLabel="✨ Improve"
            draftLabel="✨ Draft with AI"
          />
        )}
      </div>
      {hintText && (
        <p className="text-xs text-[var(--platform-text-secondary)]">{hintText}</p>
      )}
      <textarea
        className="platform-input w-full resize-y"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setUndoValue(null);
        }}
      />

      {showAi && draftOptionsOpen && !hasText && (
        <div className="space-y-2 rounded-lg border border-[var(--platform-ai-border,rgba(124,58,237,0.25))] bg-[rgba(139,92,246,0.06)] p-2.5">
          <p className="text-xs text-[var(--platform-ai-text-secondary,#6b21a8)]">
            Pick a quick intent or add optional notes — AI writes directly into the field above.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOMER_NOTE_INTENTS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={loading}
                onClick={() => void requestDraft("draft", chip.id)}
                className="platform-ai-chip text-xs"
                title={chip.hint}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]">
              Optional notes for AI
            </summary>
            <textarea
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              rows={2}
              className="platform-input mt-2 w-full resize-y text-sm"
              placeholder='e.g. "cleared customs, pickup Friday" — not a copy of the note above'
            />
            <button
              type="button"
              disabled={loading || !extraInstructions.trim()}
              onClick={() => void requestDraft("draft")}
              className="platform-ai-btn mt-2 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Drafting…
                </>
              ) : (
                "Draft from notes"
              )}
            </button>
          </details>
          <button
            type="button"
            className="text-xs text-[var(--platform-text-secondary)] hover:underline"
            onClick={() => {
              setDraftOptionsOpen(false);
              setError(null);
            }}
          >
            Close
          </button>
        </div>
      )}

      {showAi && hasText && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]">
            Optional instructions for AI
          </summary>
          <textarea
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            rows={2}
            className="platform-input mt-2 w-full resize-y text-sm"
            placeholder='Tell AI how to adjust the text above — e.g. "shorter" or "mention Tema Port"'
          />
        </details>
      )}

      {onSend && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={sending || !hasUnsavedDraft}
            onClick={() => void handleSend()}
            className="platform-btn-primary inline-flex items-center gap-1.5 text-xs"
          >
            {sending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                {sendLabel}
              </>
            )}
          </button>
          {hasUnsavedDraft && (
            <button
              type="button"
              className="text-xs text-[var(--platform-text-secondary)] hover:underline"
              disabled={sending}
              onClick={() => {
                onChange(baseline);
                setUndoValue(null);
              }}
            >
              Discard draft
            </button>
          )}
        </div>
      )}

      {configured === false && (
        <p className="text-xs text-amber-800">
          Add GEMINI_API_KEY in Vercel to enable AI assist.
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
