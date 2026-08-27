import type { PlatformNavItem } from "@/lib/platform/nav";

const IGNORED_PATH_SEGMENTS = new Set(["admin", "platform"]);

/**
 * Keyword prefix / token / includes matching starts at length 3.
 * Exact curated aliases may match at length 2 (e.g. "fx") without opening
 * prefix false-positives for "se" → keyword "security".
 */
const MIN_KEYWORD_RELATED_QUERY_LEN = 3;

/**
 * Description word-prefix matching needs a longer intentional query.
 * Blocks short prefixes like "se"/"sec" → "Security" / "Sent".
 */
const MIN_DESCRIPTION_QUERY_LEN = 4;

/**
 * Path segment matching is too weak for 1-2 char queries (false friends via
 * href segments). Allowed from length 3 as equal/prefix on segments only.
 */
const MIN_PATH_QUERY_LEN = 3;

/** Split label/description/path/keywords into searchable word tokens. */
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
 * Score keyword / alias relatedness for a single term.
 * Exact aliases allowed from length 2; prefix/token/includes from length 3+.
 * Short queries rely on label `.includes` instead — avoids "se" → security.
 */
function scoreKeywordMatch(item: PlatformNavItem, q: string): number {
  if (!item.keywords?.length || q.length < 2) return 0;

  let best = 0;
  for (const keyword of item.keywords) {
    const kw = keyword.trim().toLowerCase();
    if (!kw) continue;

    if (kw === q) {
      best = Math.max(best, 52);
      continue;
    }

    if (q.length < MIN_KEYWORD_RELATED_QUERY_LEN) continue;

    if (kw.startsWith(q)) {
      best = Math.max(best, 50);
      continue;
    }

    const tokens = navSearchTokens(kw);
    if (tokens.some((token) => token.startsWith(q))) {
      best = Math.max(best, 48);
      continue;
    }

    if (kw.includes(q)) {
      best = Math.max(best, 42);
    }
  }
  return best;
}

/**
 * Score how well a nav item matches a single search term.
 * Returns 0 when there is no meaningful match (caller should hide the item).
 *
 * Progressive filter-as-you-type: label `.includes` from the first character.
 *
 * Rank: label exact > startsWith > word-prefix > includes >
 *       keyword (exact / related) > path segment > description (longer queries).
 *
 * Description never matches short queries (blocks "se" → "Security").
 * Keyword related matches start at length 3 (blocks "se" → keyword "security").
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

  // Mid-label substring from the first character (e.g. "a" → Sales, "se" → Users).
  if (label.includes(q)) {
    return 60;
  }

  const keywordScore = scoreKeywordMatch(item, q);
  if (keywordScore > 0) return keywordScore;

  // Short queries stop here — no path or description.
  if (q.length <= 2) return 0;

  // Path: segment equal or prefix only — never mid-segment includes / full href.
  if (q.length >= MIN_PATH_QUERY_LEN) {
    if (pathSegments.some((segment) => segment === q)) return 40;
    if (pathSegments.some((segment) => segment.startsWith(q))) return 35;
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
