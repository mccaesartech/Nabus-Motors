"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  DollarSign,
  MessageSquare,
  Package,
  Search,
  Users,
} from "lucide-react";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import {
  readRecentSearches,
  saveRecentSearch,
  type AdminSearchGroup,
  type AdminSearchResult,
  type AdminSearchResultType,
} from "@/lib/admin/search";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<AdminSearchResultType, typeof Car> = {
  vehicle: Car,
  part: Package,
  lead: MessageSquare,
  customer: Users,
  sale: DollarSign,
  message: MessageSquare,
};

const SEARCH_SUGGESTIONS = [
  "Try a VIN, stock slug, make, model, year, or color",
  "Search by customer name, email, or phone",
  "Look up lead reference codes or order IDs",
  "Find parts by SKU or brand",
];

type GlobalSearchProps = {
  className?: string;
  inputClassName?: string;
  showShortcutHint?: boolean;
};

export function GlobalSearch({
  className,
  inputClassName,
  showShortcutHint = true,
}: GlobalSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<AdminSearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [recent] = useState<string[]>(() => readRecentSearches());

  const runSearch = useCallback(
    async (value: string) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const requestId = ++searchRequestIdRef.current;
      const trimmed = value.trim();
      if (trimmed.length < 2) {
        setGroups([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (requestId !== searchRequestIdRef.current) return;
        if (isAdminAuthError(res)) {
          router.push(adminLoginPath());
          return;
        }
        const json = (await res.json()) as {
          ok?: boolean;
          configured?: boolean;
          message?: string;
          groups?: AdminSearchGroup[];
        };
        if (requestId !== searchRequestIdRef.current) return;
        if (!res.ok || json.ok === false || json.configured === false) {
          setGroups([]);
          setError(json.message ?? "Search failed. Try again.");
          return;
        }
        setGroups(json.groups ?? []);
        setError(null);
      } catch {
        if (controller.signal.aborted) return;
        setGroups([]);
        setError("Search failed. Check your connection and try again.");
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, open, runSearch]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function goToFullSearch(term?: string) {
    const trimmed = (term ?? query).trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setOpen(false);
    router.push(`${platformPath("search")}?q=${encodeURIComponent(trimmed)}`);
  }

  function selectResult(result: AdminSearchResult) {
    saveRecentSearch(query);
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  const trimmed = query.trim();
  const showDropdown = open;
  const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);
  const showRecent = trimmed.length < 2 && recent.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-[2] size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
      <input
        ref={inputRef}
        type="text"
        name="global-search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const first = groups[0]?.results[0];
            if (first) selectResult(first);
            else goToFullSearch();
          }
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Search VIN, customers, leads, parts..."
        className={cn(
          "relative z-[1] h-10 w-full min-w-0 platform-input platform-input--icon pr-14 text-sm",
          inputClassName
        )}
        aria-label="Global search"
        aria-expanded={showDropdown}
        aria-controls="platform-global-search-results"
        autoComplete="off"
        spellCheck={false}
      />
      {showShortcutHint && (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 z-[2] hidden -translate-y-1/2 rounded border border-[var(--platform-border)] bg-[var(--platform-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--platform-text-secondary)] lg:inline">
          Ctrl K
        </kbd>
      )}

      {showDropdown && (
        <div
          id="platform-global-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 min-w-0 overflow-hidden rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)] shadow-xl sm:min-w-[20rem]"
        >
          {showRecent && (
            <div className="border-b border-[var(--platform-border)] px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                Recent searches
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      goToFullSearch(term);
                    }}
                    className="rounded-full border border-[var(--platform-border)] px-2.5 py-1 text-xs text-[var(--platform-text-secondary)] hover:border-[#c4b5fd] hover:text-[var(--platform-text)]"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trimmed.length >= 2 && loading && (
            <p className="px-4 py-4 text-sm text-[var(--platform-text-secondary)]">Searching…</p>
          )}

          {trimmed.length >= 2 && !loading && error && (
            <div className="px-4 py-4">
              <p className="text-sm font-medium text-[var(--platform-text)]">{error}</p>
              <button
                type="button"
                onClick={() => void runSearch(query)}
                className="mt-2 text-xs font-medium text-[var(--platform-accent)] hover:underline"
              >
                Retry search
              </button>
            </div>
          )}

          {trimmed.length >= 2 && !loading && !error && totalResults === 0 && (
            <div className="px-4 py-4">
              <p className="text-sm font-medium text-[var(--platform-text)]">
                No results for &ldquo;{trimmed}&rdquo;
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--platform-text-secondary)]">
                {SEARCH_SUGGESTIONS.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {trimmed.length >= 2 && !loading && !error && totalResults > 0 && (
            <div className="max-h-[28rem] overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.type}>
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    {group.label}
                  </p>
                  <ul>
                    {group.results.map((result) => {
                      const Icon = TYPE_ICONS[result.type];
                      return (
                        <li key={result.id}>
                          <button
                            type="button"
                            onClick={() => selectResult(result)}
                            className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(76,29,149,0.06)]"
                          >
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.1)] text-[var(--platform-accent)]">
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-[var(--platform-text)]">
                                  {result.title}
                                </span>
                                <span className="shrink-0 rounded bg-[rgba(139,92,246,0.12)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-accent)]">
                                  {result.badge}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-[var(--platform-text-secondary)]">
                                {result.subtitle}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {trimmed.length < 2 && !showRecent && (
            <p className="px-4 py-4 text-sm text-[var(--platform-text-secondary)]">
              Type at least 2 characters to search vehicles, parts, leads, customers, sales, and messages.
            </p>
          )}

          <div className="border-t border-[var(--platform-border)] px-3 py-2">
            <button
              type="button"
              onClick={() => goToFullSearch()}
              disabled={trimmed.length < 2}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium",
                trimmed.length >= 2
                  ? "text-[var(--platform-accent)] hover:bg-[rgba(76,29,149,0.06)]"
                  : "cursor-not-allowed text-[var(--platform-text-secondary)] opacity-60"
              )}
            >
              <Search className="size-4 shrink-0" />
              {trimmed.length >= 2
                ? `View all results for “${trimmed}”`
                : "Enter a search term to see all results"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchResultList({
  groups,
  onSelect,
}: {
  groups: AdminSearchGroup[];
  onSelect?: (result: AdminSearchResult) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const Icon = TYPE_ICONS[group.type];
        return (
          <section key={group.type} className="platform-card overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 border-b border-[var(--platform-border)] px-5 py-3">
              <Icon className="size-4 text-[var(--platform-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--platform-text)]">
                {group.label}
              </h2>
              <span className="ml-auto text-xs text-[var(--platform-text-secondary)]">
                {group.results.length} match{group.results.length !== 1 ? "es" : ""}
              </span>
            </div>
            <ul className="divide-y divide-[var(--platform-border)]">
              {group.results.map((result) => (
                <li key={result.id}>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(result)}
                      className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-[rgba(76,29,149,0.04)]"
                    >
                      <SearchResultRow result={result} />
                    </button>
                  ) : (
                    <a
                      href={result.href}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-[rgba(76,29,149,0.04)]"
                    >
                      <SearchResultRow result={result} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SearchResultRow({ result }: { result: AdminSearchResult }) {
  const Icon = TYPE_ICONS[result.type];
  return (
    <>
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.1)] text-[var(--platform-accent)]">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--platform-text)]">{result.title}</span>
          <span className="rounded bg-[rgba(139,92,246,0.12)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-accent)]">
            {result.badge}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-[var(--platform-text-secondary)]">
          {result.subtitle}
        </span>
      </span>
    </>
  );
}
