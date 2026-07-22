"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { platformPath } from "@/lib/platform/paths";

type DbHealth = {
  connected: boolean;
  error: string | null;
  tables?: Record<string, boolean>;
};

export function PlatformDbBanner() {
  const [db, setDb] = useState<DbHealth | null>(null);

  useEffect(() => {
    fetch("/api/admin/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.db) setDb(json.db as DbHealth);
      })
      .catch(() => undefined);
  }, []);

  if (!db) return null;

  const freightTableMissing = db.tables?.freight_quote_requests === false;
  const coreDown =
    db.connected === false ||
    db.tables?.vehicles === false ||
    db.tables?.site_content === false ||
    db.tables?.site_settings === false;
  const optionalOnlyWarning =
    Boolean(db.error) &&
    !coreDown &&
    typeof db.error === "string" &&
    db.error.startsWith("Optional tables unavailable");

  // Soften: optional-table warnings stay quiet in the shell; only block on core/freight.
  const showBanner = freightTableMissing || (Boolean(db.error) && !optionalOnlyWarning);

  if (!showBanner) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--platform-text)]"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Database setup needs attention
          </p>
          {freightTableMissing && (
            <p className="text-[var(--platform-text-secondary)]">
              Freight quote requests are not being saved — the{" "}
              <code className="text-xs">freight_quote_requests</code> table is missing. Confirm
              freight migrations are applied in Supabase, then refresh.
            </p>
          )}
          {db.error && !freightTableMissing && (
            <p className="text-[var(--platform-text-secondary)]">{db.error}</p>
          )}
          {freightTableMissing && (
            <p className="text-[var(--platform-text-secondary)]">
              Existing quotes may be in{" "}
              <Link href={platformPath("freight/quotes")} className="text-[var(--platform-accent)] hover:underline">
                Platform → Freight → Quote Requests
              </Link>{" "}
              once the freight tables are available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
