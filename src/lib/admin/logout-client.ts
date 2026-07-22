import { adminLoginPath } from "@/lib/admin/paths";

type LogoutResponse = {
  ok?: boolean;
  redirect?: string;
  message?: string;
};

export type PlatformLogoutFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function requestPlatformLogout(
  fetcher: PlatformLogoutFetch = fetch
): Promise<string> {
  const response = await fetcher("/api/admin/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as LogoutResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Log out failed. Check your connection and try again.");
  }

  return data.redirect || adminLoginPath();
}
