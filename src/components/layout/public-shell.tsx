import { getSiteContent } from "@/lib/site-content";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { SiteChrome } from "@/components/layout/site-chrome";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [content, operational] = await Promise.all([getSiteContent(), getSiteSettings()]);
  return (
    <SiteChrome content={content} operational={operational}>
      {children}
    </SiteChrome>
  );
}
