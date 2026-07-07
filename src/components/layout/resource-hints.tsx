import { getSupabaseUrl } from "@/lib/supabase/env";

/** Early connection hints for third-party origins used on public pages. */
export function ResourceHints() {
  const supabaseUrl = getSupabaseUrl();

  return (
    <>
      {supabaseUrl ? (
        <>
          <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={supabaseUrl} />
        </>
      ) : null}
      <link
        rel="preconnect"
        href="https://res.cloudinary.com"
        crossOrigin="anonymous"
      />
      <link rel="dns-prefetch" href="https://res.cloudinary.com" />
    </>
  );
}
