import { redirect } from "next/navigation";
import { platformDashboardPath } from "@/lib/platform/paths";

export default function AdminDashboardRedirect() {
  redirect(platformDashboardPath());
}
