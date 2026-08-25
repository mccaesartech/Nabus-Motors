/**
 * Debounced / sampled HTTP status audit for 401 / 403 / 500 responses.
 * Auth failures are always recorded (with IP). Server errors are sampled
 * to avoid floods from identical bursts.
 */

import type { AuditAction } from "./actions";
import { enqueueAuditLog } from "./write";

const recentKeys = new Map<string, number>();
const DEBOUNCE_MS = 15_000;
const SAMPLE_500_EVERY = 5;

let sample500Counter = 0;

function shouldSkipDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentKeys.get(key);
  if (last && now - last < DEBOUNCE_MS) return true;
  recentKeys.set(key, now);
  if (recentKeys.size > 500) {
    const cutoff = now - DEBOUNCE_MS * 2;
    for (const [k, ts] of recentKeys) {
      if (ts < cutoff) recentKeys.delete(k);
    }
  }
  return false;
}

export type HttpStatusAuditInput = {
  status: number;
  module: string;
  request?: Request | null;
  actorId?: string | null;
  actorRole?: string | null;
  message?: string | null;
};

/**
 * Best-effort audit for API failure statuses. Never throws.
 */
export function auditHttpStatusResponse(input: HttpStatusAuditInput): void {
  try {
    const { status } = input;
    if (status !== 401 && status !== 403 && status !== 500) return;

    const action: AuditAction =
      status === 401
        ? "api_unauthorized"
        : status === 403
          ? "api_forbidden"
          : "api_server_error";

    const route = (() => {
      try {
        return input.request ? new URL(input.request.url).pathname : null;
      } catch {
        return null;
      }
    })();

    const key = `${status}|${input.module}|${route ?? ""}|${input.actorId ?? ""}`;

    // Always log auth failures, but debounce identical bursts.
    if (status === 401 || status === 403) {
      if (shouldSkipDuplicate(key)) return;
    } else {
      // 500: sample + debounce identical module bursts.
      sample500Counter += 1;
      if (sample500Counter % SAMPLE_500_EVERY !== 1 && shouldSkipDuplicate(key)) {
        return;
      }
      if (shouldSkipDuplicate(`500|${input.module}`)) return;
    }

    enqueueAuditLog({
      action,
      success: false,
      actorUserId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetType: "api",
      targetId: input.module,
      targetName: route,
      errorMessage: input.message ?? `HTTP ${status}`,
      metadata: { status, module: input.module },
      request: input.request ?? null,
    });
  } catch {
    // never throw
  }
}
