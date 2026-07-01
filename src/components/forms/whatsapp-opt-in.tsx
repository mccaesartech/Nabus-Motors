"use client";

import { useEffect, useState } from "react";
import { defaultWhatsAppOptIn } from "@/lib/notifications/phone";

type WhatsAppOptInProps = {
  phone: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  onTouchedChange?: (touched: boolean) => void;
  id?: string;
};

export function WhatsAppOptIn({
  phone,
  checked,
  onChange,
  onTouchedChange,
  id = "whatsapp-opt-in",
}: WhatsAppOptInProps) {
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || !phone.trim()) return;
    onChange(defaultWhatsAppOptIn(phone));
  }, [phone, touched, onChange]);

  function markTouched() {
    setTouched(true);
    onTouchedChange?.(true);
  }

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4 rounded border-input"
        checked={checked}
        onChange={(e) => {
          markTouched();
          onChange(e.target.checked);
        }}
      />
      <span className="text-sm leading-snug text-foreground">
        <span className="font-medium">Send updates to this WhatsApp number</span>
        <span className="mt-0.5 block text-muted-foreground">
          We&apos;ll message you on WhatsApp when possible. You&apos;ll also receive email if we have your address.
        </span>
      </span>
    </label>
  );
}
