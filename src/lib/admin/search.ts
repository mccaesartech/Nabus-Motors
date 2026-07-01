export type AdminSearchResultType =
  | "vehicle"
  | "lead"
  | "customer"
  | "sale"
  | "message";

export type AdminSearchResult = {
  id: string;
  type: AdminSearchResultType;
  title: string;
  subtitle: string;
  badge: string;
  href: string;
};

export type AdminSearchGroup = {
  type: AdminSearchResultType;
  label: string;
  results: AdminSearchResult[];
};

export const SEARCH_LIMITS = {
  vehicle: 5,
  lead: 5,
  customer: 3,
  sale: 3,
  message: 3,
} as const;

export const SEARCH_FULL_LIMITS = {
  vehicle: 20,
  lead: 20,
  customer: 15,
  sale: 15,
  message: 15,
} as const;

export const RECENT_SEARCHES_KEY = "tga-admin-recent-searches";
export const MAX_RECENT_SEARCHES = 8;

export function matchesSearchQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return haystack.toLowerCase().includes(q);
}

/** Escape special characters for PostgREST ilike patterns. */
export function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function ilikePattern(query: string): string {
  return `%${escapeIlike(query.trim())}%`;
}

export function buildOrIlike(columns: string[], pattern: string): string {
  return columns.map((col) => `${col}.ilike.${pattern}`).join(",");
}

export function groupSearchResults(results: AdminSearchResult[]): AdminSearchGroup[] {
  const order: AdminSearchResultType[] = [
    "vehicle",
    "lead",
    "customer",
    "sale",
    "message",
  ];
  const labels: Record<AdminSearchResultType, string> = {
    vehicle: "Vehicles",
    lead: "Leads",
    customer: "Customers",
    sale: "Sales",
    message: "Messages",
  };

  const grouped = new Map<AdminSearchResultType, AdminSearchResult[]>();
  for (const result of results) {
    const list = grouped.get(result.type) ?? [];
    list.push(result);
    grouped.set(result.type, list);
  }

  return order
    .filter((type) => (grouped.get(type)?.length ?? 0) > 0)
    .map((type) => ({
      type,
      label: labels[type],
      results: grouped.get(type) ?? [],
    }));
}

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2 || typeof window === "undefined") return;
  const existing = readRecentSearches().filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase()
  );
  const next = [trimmed, ...existing].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}
