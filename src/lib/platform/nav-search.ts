import type { PlatformNavItem } from "@/lib/platform/nav";

const IGNORED_PATH_SEGMENTS = new Set(["admin", "platform"]);

/** Split label/description/path into searchable word tokens. */
export function navSearchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function meaningfulPathSegments(href: string): string[] {
  return href
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
    .filter((segment) => !IGNORED_PATH_SEGMENTS.has(segment));
}

/**
 * Score how well a nav item matches a single search term.
 * Returns 0 when there is no meaningful match (caller should hide the item).
 *
 * Priority: exact/prefix label → label word → label substring → path segment → description word.
 * Avoids weak full-href / mid-word description matches that surface unrelated pages.
 */
export function scoreNavSearchTerm(item: PlatformNavItem, term: string): number {
  const q = term.trim().toLowerCase();
  if (!q) return 0;

  const label = item.label.toLowerCase();
  const labelTokens = navSearchTokens(item.label);
  const pathSegments = meaningfulPathSegments(item.href);

  if (label === q) return 100;
  if (label.startsWith(q)) return 90;
  if (labelTokens.some((token) => token.startsWith(q))) return 80;
  // Mid-label substring only for longer queries (avoids "or" → Reports).
  if (q.length >= 3 && label.includes(q)) return 60;

  if (pathSegments.some((segment) => segment === q)) return 70;
  if (pathSegments.some((segment) => segment.startsWith(q))) return 55;
  // Mid-segment path match only for longer queries (e.g. "move" → movements).
  if (q.length >= 3 && pathSegments.some((segment) => segment.includes(q))) return 40;

  // Description: word-prefix only, and only for queries long enough to be intentional.
  if (item.description && q.length >= 3) {
    const descTokens = navSearchTokens(item.description);
    if (descTokens.some((token) => token.startsWith(q))) return 25;
  }

  return 0;
}

/** Score a nav item against a full query (space-separated terms must all match). */
export function scoreNavSearch(item: PlatformNavItem, query: string): number {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return 0;

  let total = 0;
  for (const term of terms) {
    const score = scoreNavSearchTerm(item, term);
    if (score <= 0) return 0;
    total += score;
  }
  return total;
}

export type RankedNavSearchResult = {
  item: PlatformNavItem;
  score: number;
};

/** Filter to relevant matches and rank highest score first (stable by label). */
export function rankNavSearchResults(
  items: PlatformNavItem[],
  query: string
): RankedNavSearchResult[] {
  const q = query.trim();
  if (!q) return [];

  return items
    .map((item) => ({ item, score: scoreNavSearch(item, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.label.localeCompare(b.item.label);
    });
}

export function navItemMatchesSearch(item: PlatformNavItem, query: string): boolean {
  return scoreNavSearch(item, query) > 0;
}
