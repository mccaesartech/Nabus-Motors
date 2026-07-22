"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityDetails } from "@/components/platform/activity-details";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import type { PlatformActivityRow } from "@/lib/platform/modules";
import { formatPlatformDateTime } from "@/lib/platform/datetime";

const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  invite_sent: "Invitation sent",
  invite_accepted: "Invitation accepted",
  user_updated: "User updated",
  user_password_set: "User password set",
  user_removed: "User removed",
  vehicle_created: "Vehicle created",
  vehicle_submitted: "Vehicle submitted for approval",
  vehicle_approved: "Vehicle approved",
  vehicle_rejected: "Vehicle rejected",
  vehicle_updated: "Vehicle updated",
  vehicle_auto_pre_order: "Auto-switched to pre-order",
  vehicle_deleted: "Vehicle deleted",
  lead_updated: "Lead updated",
  message_replied: "Message replied",
  team_message_sent: "Team message sent",
  team_group_created: "Group created",
  team_group_updated: "Group updated",
  sale_updated: "Sale updated",
  settings_updated: "Settings updated",
  export: "Data exported",
  expense_added: "Expense added",
  item_deleted: "Item deleted",
  item_restored: "Item restored",
  item_permanently_deleted: "Item permanently deleted",
  customer_deleted: "Customer deleted",
};

function resourceLabel(row: PlatformActivityRow): string {
  if (row.action === "team_message_sent") {
    const label = row.metadata?.conversation_label;
    if (typeof label === "string" && label.length > 0) return label;
  }
  return row.resource ?? "—";
}

export default function ActivityPage() {
  const router = useRouter();
  const [activity, setActivity] = useState<PlatformActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/activity?limit=200");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    if (res.status === 403) {
      router.push("/platform/dashboard");
      return;
    }
    const json = await res.json();
    setActivity(json.activity ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading activity…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team activity"
        description="Owner view of sign-ins, invites, team messages, edits, exports, and other platform actions."
        breadcrumb="Users / Activity"
        backFallbackHref={platformPath("users")}
        backLabel="Back to users"
      />

      <div className="platform-card overflow-hidden rounded-xl">
        <table className="platform-table w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--platform-text-secondary)]">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {activity.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--platform-text-secondary)]">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              activity.map((row) => {
                const actorRole =
                  typeof row.metadata?.sender_role_label === "string"
                    ? row.metadata.sender_role_label
                    : typeof row.metadata?.sender_role === "string"
                      ? row.metadata.sender_role
                      : null;

                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PlatformDateTime
                        value={row.created_at}
                        mode="relative"
                        className="font-medium text-[var(--platform-text-primary)]"
                      />
                      <div className="text-xs text-[var(--platform-text-secondary)]">
                        {formatPlatformDateTime(row.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.actor_name ?? "—"}</div>
                      <div className="text-xs text-[var(--platform-text-secondary)]">
                        {row.actor_email ?? ""}
                      </div>
                      {actorRole && row.action === "team_message_sent" ? (
                        <div className="text-xs text-[var(--platform-text-secondary)]">{actorRole}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{ACTION_LABELS[row.action] ?? row.action}</td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                      {resourceLabel(row)}
                    </td>
                    <td className="px-4 py-3">
                      <ActivityDetails action={row.action} metadata={row.metadata ?? {}} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
