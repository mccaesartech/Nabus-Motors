import { redirect } from "next/navigation";
import { platformPath } from "@/lib/platform/paths";

/**
 * Admin Error Log UI removed — developers use Sentry.
 * Keep this route so old bookmarks/links land on the dashboard.
 */
export default function ErrorLogRedirectPage() {
  redirect(platformPath("dashboard"));
}
