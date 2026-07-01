const currencyDisplayNames =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "currency" })
    : null;

/** Human-readable currency name (e.g. "Ghanaian Cedi" for GHS). */
export function getCurrencyLabel(code: string): string {
  if (!currencyDisplayNames) return code;
  try {
    return currencyDisplayNames.of(code) ?? code;
  } catch {
    return code;
  }
}
