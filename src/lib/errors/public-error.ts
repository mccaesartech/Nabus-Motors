export const PUBLIC_UNEXPECTED_ERROR_MESSAGE =
  "The page failed to load completely. Please try again or reload the page.";

export function publicErrorReference(
  error: { digest?: string } | null | undefined
): string | null {
  const digest = error?.digest?.trim();
  if (!digest || !/^[a-zA-Z0-9._-]+$/.test(digest)) return null;
  return `Reference: ${digest.slice(0, 80)}`;
}
