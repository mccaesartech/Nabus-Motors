"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";

type AiFieldActionsProps = {
  loading?: boolean;
  hasText: boolean;
  onImprove: () => void;
  onDraft?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
  improveLabel?: string;
  draftLabel?: string;
  className?: string;
};

/** Inline ✨ Improve / Draft controls for a textarea — no duplicate input box. */
export function AiFieldActions({
  loading = false,
  hasText,
  onImprove,
  onDraft,
  canUndo = false,
  onUndo,
  improveLabel = "Improve",
  draftLabel = "Draft with AI",
  className = "",
}: AiFieldActionsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {hasText ? (
        <button
          type="button"
          disabled={loading}
          onClick={onImprove}
          className="platform-ai-inline-btn"
          title="Polish the text in this field with AI"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {loading ? "Working…" : improveLabel}
        </button>
      ) : onDraft ? (
        <button
          type="button"
          disabled={loading}
          onClick={onDraft}
          className="platform-ai-inline-btn"
          title="Generate a draft from quick intents or optional notes"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {loading ? "Working…" : draftLabel}
        </button>
      ) : null}

      {canUndo && onUndo && (
        <button
          type="button"
          disabled={loading}
          onClick={onUndo}
          className="platform-ai-undo-btn inline-flex items-center gap-1 px-2 py-1 text-xs"
          title="Restore text before the last AI change"
        >
          <RotateCcw className="size-3" />
          Undo
        </button>
      )}
    </div>
  );
}
