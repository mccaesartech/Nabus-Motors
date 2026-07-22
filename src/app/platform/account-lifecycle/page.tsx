"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { StatusBadge } from "@/components/platform/status-badge";
import { Input } from "@/components/ui/input";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { DELETION_REASON_LABELS, type DeletionReason } from "@/lib/customer/account-lifecycle.shared";
import type { AccountLifecycleListItem } from "@/lib/platform/account-lifecycle-admin";
import { cn } from "@/lib/utils";

type TabId = "active" | "suspended" | "pending_deletion" | "archived";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "active", label: "Active Accounts" },
  { id: "suspended", label: "Suspended Accounts" },
  { id: "pending_deletion", label: "Pending Deletion" },
  { id: "archived", label: "Archived Accounts" },
];

function displayName(row: AccountLifecycleListItem) {
  const full = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (row.is_anonymized) return "Anonymized user";
  return row.registration_id ?? row.id.slice(0, 8);
}

function reasonLabel(reason: string | null) {
  if (!reason) return "—";
  if ((Object.keys(DELETION_REASON_LABELS) as DeletionReason[]).includes(reason as DeletionReason)) {
    return DELETION_REASON_LABELS[reason as DeletionReason];
  }
  return reason;
}

export default function AccountLifecyclePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("pending_deletion");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AccountLifecycleListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<
    Array<{
      id: string;
      created_at: string;
      action: string;
      administrator_id: string | null;
      ip_address: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab });
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/admin/account-lifecycle?${params}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setAccounts(json.accounts ?? []);
    setLoading(false);
  }, [router, search, tab]);

  const loadDetail = useCallback(async (userId: string) => {
    const res = await fetch(`/api/admin/account-lifecycle?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return;
    const json = await res.json();
    setAudit(json.audit ?? []);
    setSelectedId(userId);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Lifecycle"
        description="Monitor customer account status, pending deletions, and retention windows."
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setSelectedId(null);
              setAudit([]);
            }}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-brand-purple/10 text-brand-purple"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, name, registration ID…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="overflow-hidden rounded-lg border">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No accounts in this section.</p>
          ) : (
            <ul className="divide-y">
              {accounts.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(row.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-muted/40",
                      selectedId === row.id && "bg-brand-purple/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{displayName(row)}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.is_anonymized ? "Anonymized" : row.email ?? "No email"}
                        </p>
                        {row.registration_id ? (
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.registration_id}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={row.account_status} />
                    </div>
                    {row.retention_expires_at ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Retention until{" "}
                        <PlatformDateTime value={row.retention_expires_at} />
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-lg border p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Select an account to view lifecycle details and audit history.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">{displayName(selected)}</p>
                <p className="text-xs text-muted-foreground">{selected.id}</p>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={selected.account_status} />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{reasonLabel(selected.deletion_reason)}</dd>
                </div>
                {selected.deletion_requested_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Requested</dt>
                    <dd>
                      <PlatformDateTime value={selected.deletion_requested_at} />
                    </dd>
                  </div>
                ) : null}
                {selected.retention_expires_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Retention ends</dt>
                    <dd>
                      <PlatformDateTime value={selected.retention_expires_at} />
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div>
                <p className="mb-2 text-sm font-medium">Audit log</p>
                {audit.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No lifecycle events recorded.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
                    {audit.map((entry) => (
                      <li key={entry.id} className="rounded border px-2 py-1.5">
                        <p className="font-medium">{entry.action}</p>
                        <p className="text-muted-foreground">
                          <PlatformDateTime value={entry.created_at} />
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
