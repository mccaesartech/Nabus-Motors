"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { PlatformNavItem } from "@/lib/platform/nav";
import { rankNavSearchResults } from "@/lib/platform/nav-search";
import { cn } from "@/lib/utils";

type SidebarSearchProps = {
  items: PlatformNavItem[];
  collapsed: boolean;
  onNavigate: () => void;
  onExpand?: () => void;
  onQueryChange?: (query: string) => void;
  isActive: (href: string) => boolean;
};

export function SidebarSearch({
  items,
  collapsed,
  onNavigate,
  onExpand,
  onQueryChange,
  isActive,
}: SidebarSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => rankNavSearchResults(items, query).map((entry) => entry.item),
    [items, query]
  );

  const updateQuery = (next: string) => {
    setQuery(next);
    // Propagate immediately so the sidebar tree filters on the same keystroke.
    onQueryChange?.(next);
  };

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
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search menu…"
          className="platform-input platform-input--icon h-9 w-full text-sm"
          autoComplete="off"
        />
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
