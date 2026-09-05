"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { cn } from "@/lib/utils";

type NabusSearchLayerProps = {
  open: boolean;
  onClose: () => void;
};

export function NabusSearchLayer({ open, onClose }: NabusSearchLayerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useLockBodyScroll(open);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open]);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = query.trim();
      if (!q) return;
      onClose();
      router.push(`${ROUTES.auto.inventory}?q=${encodeURIComponent(q)}`);
    },
    [query, onClose, router]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--nabus-paper)]">
      <div className="flex items-center justify-between border-b border-[var(--nabus-border)] px-4 py-4 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--nabus-muted)]">
          Search the showroom
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 min-w-10 items-center justify-center text-[var(--nabus-graphite)] transition-opacity hover:opacity-70"
          aria-label="Close search"
        >
          <X className="size-5" />
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-1 flex-col px-4 pt-12 sm:px-8 sm:pt-16">
        <label htmlFor="nabus-search-input" className="sr-only">
          Search vehicles
        </label>
        <div className="relative max-w-3xl">
          <Search className="pointer-events-none absolute left-0 top-1/2 size-6 -translate-y-1/2 text-[var(--nabus-muted)]" />
          <input
            ref={inputRef}
            id="nabus-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Make, model, year, body type…"
            className="w-full border-0 border-b border-[var(--nabus-border)] bg-transparent py-4 pl-10 pr-4 text-2xl font-medium tracking-tight text-[var(--nabus-graphite)] placeholder:text-[var(--nabus-muted)]/60 focus:border-[var(--nabus-wine)] focus:outline-none sm:text-4xl"
            autoComplete="off"
          />
        </div>

        <div className="mt-10 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--nabus-muted)]">
            Quick filters
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: "SUV", href: `${ROUTES.auto.inventory}?bodyType=SUV` },
              { label: "Sedan", href: `${ROUTES.auto.inventory}?bodyType=Sedan` },
              { label: "Under $30k", href: `${ROUTES.auto.inventory}?priceMax=30000` },
              { label: "In Ghana", href: ROUTES.auto.availableLocally },
              { label: "Import", href: ROUTES.auto.preorder },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  onClose();
                  router.push(chip.href);
                }}
                className={cn(
                  "border border-[var(--nabus-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide",
                  "text-[var(--nabus-graphite)] transition-colors duration-200 hover:border-[var(--nabus-wine)] hover:text-[var(--nabus-wine)]"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-auto pb-8 text-xs text-[var(--nabus-muted)]">
          Press Enter to search · Esc to close
        </p>
      </form>
    </div>
  );
}
