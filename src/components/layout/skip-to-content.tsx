/** Visually hidden until focused — jumps keyboard users past chrome to page content. */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-purple focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-cta-gold focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
