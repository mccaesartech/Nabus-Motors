"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { PlatformNavItem } from "@/lib/platform/nav";
import { cn } from "@/lib/utils";

type SidebarSearchProps = {
  items: PlatformNavItem[];
  collapsed: boolean;
  onNavigate: () => void;
  onExpand?: () => void;
  isActive: (href: string) => boolean;
};

export function SidebarSearch({
  items,
  collapsed,
  onNavigate,
  onExpand,
  isActive,
}: SidebarSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [items, query]);

  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          className="platform-btn-ghost flex w-full items-center justify-center"
          aria-label="Search navigation"
          title="Search navigation"
          onClick={() => {
            onExpand?.();
          }}
        >
          <Search className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 pb-3">
      <label className="sr-only" htmlFor="platform-sidebar-search">
        Filter navigation
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]"
          aria-hidden
        />
        <input
          ref={inputRef}
          id="platform-sidebar-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search menu…"
          className="platform-input platform-input--icon h-9 w-full pr-8 text-sm"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {focused && query.trim() && (
        <ul
          className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] py-1 shadow-md"
          role="listbox"
          aria-label="Search results"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--platform-text-secondary)]">
              No matching pages
            </li>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} role="option">
                  <Link
                    href={item.href}
                    onClick={() => {
                      inputRef.current?.blur();
                      setFocused(false);
                      onNavigate();
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[rgba(139,92,246,0.08)]",
                      isActive(item.href) && "font-semibold text-[var(--platform-text)]"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
