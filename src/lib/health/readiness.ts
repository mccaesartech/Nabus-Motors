import "server-only";

import { isAdminSessionSecretConfigured } from "@/lib/admin/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";
import {
  evaluateReadinessChecks,
  type ReadinessDependencies,
  type ReadinessResult,
} from "@/lib/health/readiness-core";

const DEFAULT_TIMEOUT_MS = 2_000;

function configurationReady(): boolean {
  return Boolean(
    getSupabaseUrl() &&
      getSupabaseAnonKey() &&
      getSupabaseServiceRoleKey() &&
      isAdminSessionSecretConfigured() &&
      process.env.CRON_SECRET?.trim()
  );
}

async function databaseReady(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  const supabase = createAdminSupabase();
  if (!supabase) return false;

  const query = supabase.from("site_content").select("key", { head: true }).limit(1);
  const probe = Promise.resolve(query)
    .then(({ error }) => !error)
    .catch(() => false);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(false), timeoutMs);
  });

  const result = await Promise.race([probe, timeout]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  return result;
}

function release(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.NEXT_PUBLIC_BUILD_ID?.slice(0, 40) ||
    "unknown"
  );
}

const defaultDependencies: ReadinessDependencies = {
  configurationReady,
  databaseReady,
  release,
};

export async function evaluateReadiness(
  dependencies: ReadinessDependencies = defaultDependencies
): Promise<ReadinessResult> {
  return evaluateReadinessChecks(dependencies);
}
