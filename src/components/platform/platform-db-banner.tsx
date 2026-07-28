"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type DbHealth = {
  connected: boolean;
  error: string | null;
  tables?: Record<string, boolean>;
};

/**
 * Only surface hard connectivity / core-table failures.
 * Optional-table and migration gaps are logged server-side (Sentry), not shown to owners.
 */
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

  const coreDown =
    db.connected === false ||
    db.tables?.vehicles === false ||
    db.tables?.site_content === false ||
    db.tables?.site_settings === false;

  if (!coreDown) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--platform-text)]"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Database connection needs attention
          </p>
          <p className="text-[var(--platform-text-secondary)]">
            Core inventory or site content could not be reached. Refresh in a moment. If this
            persists, contact your developer — details are logged for ops.
          </p>
        </div>
      </div>
    </div>
  );
}
