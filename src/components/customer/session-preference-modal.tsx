"use client";

import { useState } from "react";
import { Clock, LogIn, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionPreference } from "@/lib/customer/session-preference";

const OPTIONS: {
  value: SessionPreference;
  title: string;
  description: string;
  icon: typeof LogIn;
}[] = [
  {
    value: "stay_signed_in",
    title: "Stay signed in",
    description: "Keep me signed in on this device for up to 24 hours.",
    icon: LogIn,
  },
  {
    value: "ask_each_time",
    title: "Ask me each time",
    description: "Sign out when I close the browser. Sign in again next visit.",
    icon: Clock,
  },
  {
    value: "no_save",
    title: "Don't save login",
    description: "Sign out when I close this tab. Best for shared devices.",
    icon: Shield,
  },
];

type SessionPreferenceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (preference: SessionPreference) => void | Promise<void>;
  initialPreference?: SessionPreference | null;
};

export function SessionPreferenceModal({
  open,
  onOpenChange,
  onConfirm,
  initialPreference = null,
}: SessionPreferenceModalProps) {
  const [selected, setSelected] = useState<SessionPreference>(
    initialPreference ?? "ask_each_time"
  );
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(selected);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>How should we keep you signed in?</DialogTitle>
          <DialogDescription>
            Choose how Nabus Motors remembers your account on this device. You can
            change this anytime from the sign-in page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelected(option.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-brand-purple bg-brand-purple/5"
                    : "border-border hover:border-brand-purple/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-brand-purple/15 text-brand-purple" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <Button type="button" className="w-full" size="lg" disabled={saving} onClick={() => void handleConfirm()}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
