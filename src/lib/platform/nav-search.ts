import type { PlatformNavItem } from "@/lib/platform/nav";

const IGNORED_PATH_SEGMENTS = new Set(["admin", "platform"]);

/**
 * Mid-label substring matching (`.includes` on the full label) requires a longer
 * intentional query. Blocks "se" -> Users and "ser" -> Users.
 */
const MIN_SUBSTRING_QUERY_LEN = 4;

/**
 * Keyword prefix / token matching starts at length 3 (mail, team, currency).
 * Exact curated aliases may match at length 2 (e.g. "fx") without opening
 * prefix false-positives for "se".
 */
const MIN_KEYWORD_PREFIX_QUERY_LEN = 3;

/**
 * Description word-prefix matching needs a longer intentional query.
 * Blocks short prefixes like "se"/"sec" -> "Security" / "Sent".
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

    if (q.length < MIN_KEYWORD_PREFIX_QUERY_LEN) continue;

    if (kw.startsWith(q)) {
      best = Math.max(best, 50);
      continue;
    }

    const tokens = navSearchTokens(kw);
    if (tokens.some((token) => token.startsWith(q))) {
      best = Math.max(best, 48);
      continue;
    }

    if (q.length >= MIN_SUBSTRING_QUERY_LEN && kw.includes(q)) {
      best = Math.max(best, 42);
    }
  }
  return best;
}

/**
 * Score how well a nav item matches a single search term.
 * Returns 0 when there is no meaningful match (caller should hide the item).
 *
 * Priority: label hits -> keyword/alias -> path segment -> description word.
 *
 * Length rules:
 * - 1-2 chars: label exact/prefix/word-prefix, plus exact curated keywords only
 * - 3 chars: above + keyword prefixes + path segment equal/prefix
 * - >=4 chars: above + mid-label includes + description word-prefix
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

  // Mid-label substring only for longer queries (avoids "ser" -> Users).
  // Still a label hit — ranks above keywords/aliases.
  if (q.length >= MIN_SUBSTRING_QUERY_LEN && label.includes(q)) {
    return 60;
  }

  // Curated aliases (exact "fx" at len 2; related prefixes from len 3).
  const keywordScore = scoreKeywordMatch(item, q);
  if (keywordScore > 0) return keywordScore;

  // Short queries stop here — no path or description.
  if (q.length <= 2) return 0;

  // Path: segment equal or prefix only — never mid-segment includes / full href.
  // Ranked below keywords so related aliases win over structural path hits.
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