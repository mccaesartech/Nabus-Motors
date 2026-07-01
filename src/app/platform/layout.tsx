import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlatformShell } from "@/components/platform/platform-shell";
import { getPlatformAuth } from "@/lib/admin/auth";
import { adminLoginPath } from "@/lib/admin/paths";
import "./platform.css";

function isInvitePath(pathname: string) {
  return /^\/platform\/invite\/[^/]+$/.test(pathname);
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (isInvitePath(pathname)) {
    return <div className="platform-theme min-h-dvh overflow-x-clip">{children}</div>;
  }

  const auth = await getPlatformAuth();
  if (!auth) {
    redirect(adminLoginPath());
  }

  return (
    <PlatformShell
      userName={auth.name}
      userRole={auth.role}
      userEmail={auth.email}
    >
      {children}
    </PlatformShell>
  );
}
