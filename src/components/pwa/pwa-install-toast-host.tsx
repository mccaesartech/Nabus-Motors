"use client";

import { useEffect, useState } from "react";
import { PWA_INSTALL_TOAST_EVENT } from "@/lib/pwa/install-utils";

export function PwaInstallToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message ?? "Open browser menu → Install app");
    }

    window.addEventListener(PWA_INSTALL_TOAST_EVENT, onToast);
    return () => window.removeEventListener(PWA_INSTALL_TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-sm rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-luxury-lg"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
