"use client";

import { useCallback, useEffect, useState } from "react";
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

  const runSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) {
        setGroups([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}&full=1`
        );
        if (isAdminAuthError(res)) {
          router.push(adminLoginPath());
          return;
        }
        if (!res.ok) {
          setGroups([]);
          return;
        }
        const json = await res.json();
        setGroups(json.groups ?? []);
        saveRecentSearch(trimmed);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) {
      setQuery(q);
      void runSearch(q);
    }
  }, [searchParams, runSearch]);

  const trimmed = query.trim();
  const total = groups.reduce((sum, g) => sum + g.results.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="Find vehicles, customers, leads, sales, and messages in one place."
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
              placeholder="Search vehicles, customers, leads, sales..."
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

      {!loading && trimmed.length >= 2 && total === 0 && (
        <div className="platform-card rounded-xl px-6 py-12 text-center">
          <p className="text-base font-medium text-[var(--platform-text)]">
            No results for &ldquo;{trimmed}&rdquo;
          </p>
          <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">
            Try a different spelling, customer email, VIN, or vehicle make and model.
          </p>
        </div>
      )}

      {!loading && total > 0 && (
        <>
          <p className="text-sm text-[var(--platform-text-secondary)]">
            {total} result{total !== 1 ? "s" : ""} for &ldquo;{trimmed}&rdquo;
          </p>
          <SearchResultList groups={groups} />
        </>
      )}

      {!loading && trimmed.length < 2 && (
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
