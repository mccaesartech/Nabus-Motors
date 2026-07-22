"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EnhancedColumn<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  defaultVisible?: boolean;
  sortable?: boolean;
};

export type EnhancedDataTableProps<T> = {
  columns: EnhancedColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  emptyMessage?: string;
  loading?: boolean;
  pageSize?: number;
  toolbarExtra?: ReactNode;
  onRowClick?: (row: T) => void;
  bulkActions?: ReactNode;
  className?: string;
  minWidth?: string;
  hideSearch?: boolean;
};

type SortState = {
  columnId: string;
  direction: "asc" | "desc";
};

export function EnhancedDataTable<T>({
  columns,
  data,
  rowKey,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  emptyMessage = "No results found.",
  loading = false,
  pageSize = 25,
  toolbarExtra,
  onRowClick,
  bulkActions,
  className,
  minWidth = "48rem",
  hideSearch = false,
}: EnhancedDataTableProps<T>) {
  const defaultVisibility = useMemo(
    () =>
      Object.fromEntries(
        columns.map((col) => [col.id, col.defaultVisible !== false])
      ),
    [columns]
  );

  const [visibleColumns, setVisibleColumns] = useState(defaultVisibility);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(0);
  const [internalSearch, setInternalSearch] = useState("");

  const search = searchValue ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;

  const visibleCols = columns.filter((col) => visibleColumns[col.id]);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortValue) return data;
    const sorted = [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }, [columns, data, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = sortedData.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(columnId: string) {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.sortable && !col?.sortValue) return;
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  function SortIcon({ columnId }: { columnId: string }) {
    if (sort?.columnId !== columnId) {
      return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
    }
    return sort.direction === "asc" ? (
      <ArrowUp className="size-3" aria-hidden />
    ) : (
      <ArrowDown className="size-3" aria-hidden />
    );
  }

  return (
    <div className={cn("min-w-0 max-w-full space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {!hideSearch ? (
          <div className="relative min-w-0 flex-1 max-w-md sm:min-w-[12rem]">
            <label className="sr-only" htmlFor="enhanced-table-search">
              {searchPlaceholder}
            </label>
            <input
              id="enhanced-table-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="platform-input h-9 w-full text-sm"
            />
          </div>
        ) : null}
        {toolbarExtra}
        {bulkActions}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowColumnMenu((v) => !v)}
            className="platform-btn-ghost flex items-center gap-1.5 text-xs"
            aria-expanded={showColumnMenu}
            aria-haspopup="true"
          >
            <Columns3 className="size-3.5" aria-hidden />
            Columns
          </button>
          {showColumnMenu && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Close column menu"
                onClick={() => setShowColumnMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] py-1 shadow-lg">
                {columns.map((col) => (
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-[rgba(139,92,246,0.06)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.id]}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [col.id]: e.target.checked,
                        }))
                      }
                      className="size-3.5 rounded border-[var(--platform-border)]"
                    />
                    {col.header}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="platform-card min-w-0 max-w-full overflow-hidden rounded-xl">
        <div className="platform-table-scroll max-h-[70vh] overflow-x-auto overflow-y-auto">
          <table
            className="platform-table w-full text-left text-sm"
            style={{ minWidth }}
          >
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                {visibleCols.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn(
                      "px-4 py-3 font-medium",
                      col.headerClassName,
                      (col.sortable || col.sortValue) && "cursor-pointer select-none"
                    )}
                    onClick={() => toggleSort(col.id)}
                    aria-sort={
                      sort?.columnId === col.id
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {(col.sortable || col.sortValue) && <SortIcon columnId={col.id} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={visibleCols.length}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleCols.length}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageData.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cn(
                      "border-t border-[var(--platform-border)]",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {visibleCols.map((col) => (
                      <td key={col.id} className={cn("px-4 py-3", col.className)}>
                        {col.accessor?.(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {sortedData.length > pageSize && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--platform-border)] px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
            <span>
              Showing {safePage * pageSize + 1}–
              {Math.min((safePage + 1) * pageSize, sortedData.length)} of {sortedData.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="platform-btn-ghost size-8 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-[4rem] text-center tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="platform-btn-ghost size-8 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
