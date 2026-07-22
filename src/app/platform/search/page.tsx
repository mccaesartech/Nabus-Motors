"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { GlobalSearch, SearchResultList } from "@/components/platform/global-search";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { saveRecentSearch, type AdminSearchGroup } from "@/lib/admin/search";
import { platformPath } from "@/lib/platform/paths";

export default function PlatformSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [groups, setGroups] = useState<AdminSearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(
    async (value: string) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const requestId = ++requestIdRef.current;
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
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}&full=1`,
          { signal: controller.signal }
        );
        if (requestId !== requestIdRef.current) return;
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
        if (requestId !== requestIdRef.current) return;
        if (!res.ok || json.ok === false || json.configured === false) {
          setGroups([]);
          setError(json.message ?? "Search failed. Try again.");
          return;
        }
        setGroups(json.groups ?? []);
        saveRecentSearch(trimmed);
      } catch {
        if (controller.signal.aborted) return;
        setGroups([]);
        setError("Search failed. Check your connection and try again.");
      } finally {
        if (requestId === requestIdRef.current) {
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
    const q = searchParams.get("q");
    if (q !== null) {
      setQuery(q);
      void runSearch(q);
    }
  }, [searchParams, runSearch]);

  // Debounced live search while typing (keeps URL in sync on Enter/Search).
  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    if (query.trim() === urlQ.trim()) return;
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, searchParams, runSearch]);

  const trimmed = query.trim();
  const total = groups.reduce((sum, g) => sum + g.results.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="Find vehicles, customers, leads, sales, parts, and messages in one place."
        breadcrumb="Platform"
        showBack={false}
      />

      <div className="platform-card rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const term = query.trim();
                  if (term.length >= 2) {
                    router.push(`${platformPath("search")}?q=${encodeURIComponent(term)}`);
                  }
                }
              }}
              placeholder="Search VIN, customers, leads, parts, sales..."
              className="platform-input platform-input--icon h-11 w-full text-base"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const term = query.trim();
              if (term.length >= 2) {
                router.push(`${platformPath("search")}?q=${encodeURIComponent(term)}`);
              }
            }}
            className="platform-btn-primary h-11 px-5"
          >
            Search
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-[var(--platform-text-secondary)]">Searching…</p>
      )}

      {!loading && error && (
        <div className="platform-card rounded-xl px-6 py-8 text-center">
          <p className="text-base font-medium text-[var(--platform-text)]">{error}</p>
          <button
            type="button"
            onClick={() => void runSearch(query)}
            className="mt-3 text-sm font-medium text-[var(--platform-accent)] hover:underline"
          >
            Retry search
          </button>
        </div>
      )}

      {!loading && !error && trimmed.length >= 2 && total === 0 && (
        <div className="platform-card rounded-xl px-6 py-12 text-center">
          <p className="text-base font-medium text-[var(--platform-text)]">
            No results for &ldquo;{trimmed}&rdquo;
          </p>
          <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">
            Try a different spelling, customer email, VIN, stock slug, SKU, or reference code.
          </p>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <>
          <p className="text-sm text-[var(--platform-text-secondary)]">
            {total} result{total !== 1 ? "s" : ""} for &ldquo;{trimmed}&rdquo;
          </p>
          <SearchResultList groups={groups} />
        </>
      )}

      {!loading && !error && trimmed.length < 2 && (
        <div className="platform-card rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-[var(--platform-text-secondary)]">
            Enter at least 2 characters to search across your entire dealership data.
          </p>
          <div className="mt-4 flex justify-center">
            <GlobalSearch className="w-full max-w-md" showShortcutHint={false} />
          </div>
        </div>
      )}
    </div>
  );
}
