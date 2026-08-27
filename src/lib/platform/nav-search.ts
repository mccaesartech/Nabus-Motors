import type { PlatformNavItem } from "@/lib/platform/nav";

const IGNORED_PATH_SEGMENTS = new Set(["admin", "platform"]);

/**
 * Mid-label substring matching (`.includes` on the full label) requires a longer
 * intentional query. Blocks "se" → Users and "ser" → Users.
 */
const MIN_SUBSTRING_QUERY_LEN = 4;

/**
 * Description word-prefix matching needs a longer intentional query.
 * Blocks short prefixes like "se"/"sec" → "Security" / "Sent".
 */
const MIN_DESCRIPTION_QUERY_LEN = 4;

/**
 * Path segment matching is too weak for 1–2 char queries (false friends via
 * href segments). Allowed from length 3 as equal/prefix on segments only.
 */
const MIN_PATH_QUERY_LEN = 3;

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
 *
 * Length rules:
 * - 1–2 chars: label exact, full-label prefix, or label-word prefix ONLY
 * - 3 chars: above + path segment equal/prefix (no mid-label, no description)
 * - ≥4 chars: above + mid-label includes + description word-prefix
 *
 * Path matching never uses mid-segment `.includes` or full-href substrings.
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

  // Short queries: strong label matches only — no path, description, or mid-label.
  if (q.length <= 2) return 0;

  // Mid-label substring only for longer queries (avoids "ser" → Users).
  if (q.length >= MIN_SUBSTRING_QUERY_LEN && label.includes(q)) {
    return 60;
  }

  // Path: segment equal or prefix only — never mid-segment includes / full href.
  if (q.length >= MIN_PATH_QUERY_LEN) {
    if (pathSegments.some((segment) => segment === q)) return 70;
    if (pathSegments.some((segment) => segment.startsWith(q))) return 55;
  }

  // Description: word-prefix only, and only for queries long enough to be intentional.
  if (item.description && q.length >= MIN_DESCRIPTION_QUERY_LEN) {
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
