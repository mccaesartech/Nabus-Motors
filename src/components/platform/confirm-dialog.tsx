"use client";

import { useEffect, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Default phrase for destructive delete / trash actions (case-insensitive). */
export const DELETE_CONFIRM_PHRASE = "yes delete";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  /** Shown on the confirm button while the action is in flight (before close). */
  busyLabel?: string;
  destructive?: boolean;
  /**
   * When set, the confirm button stays disabled until the user types this
   * phrase (case-insensitive, trimmed). Use for delete / trash / permanent delete.
   */
  confirmPhrase?: string;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  busyLabel,
  destructive = false,
  confirmPhrase,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const phraseInputId = useId();
  const resolvedBusyLabel =
    busyLabel ?? (destructive ? "Deleting…" : "Working…");

  useEffect(() => {
    if (!open) {
      setTypedPhrase("");
      setBusy(false);
    }
  }, [open]);

  const phraseRequired = Boolean(confirmPhrase);
  const phraseMatched =
    !phraseRequired ||
    typedPhrase.trim().toLowerCase() === confirmPhrase!.trim().toLowerCase();

  async function handleConfirm() {
    if (!phraseMatched || busy) return;
    setBusy(true);
    // Close immediately so confirm feels instant; parent shows progress/toasts.
    onOpenChange(false);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>
        </DialogHeader>
        {children}
        {phraseRequired && (
          <div className="space-y-1.5 px-1">
            <label
              htmlFor={phraseInputId}
              className="text-xs font-medium text-[var(--platform-text-secondary)]"
            >
              Type <span className="font-semibold text-[var(--platform-text)]">{confirmPhrase}</span>{" "}
              to confirm
            </label>
            <input
              id={phraseInputId}
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              className="platform-input w-full"
              placeholder={confirmPhrase}
              aria-required
              onKeyDown={(e) => {
                if (e.key === "Enter" && phraseMatched && !busy) {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy || !phraseMatched}
            onClick={handleConfirm}
          >
            {busy ? resolvedBusyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
