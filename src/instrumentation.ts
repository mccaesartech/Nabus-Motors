import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";
import { buildRequestErrorRecord } from "@/lib/observability/request-error";

export async function register() {
  // Provider-neutral hook. Vercel captures stderr as structured JSON.
  // Sentry init is gated by DSN inside the config modules (no-op when unset).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;
  const record = buildRequestErrorRecord({
    digest,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    runtime: process.env.NEXT_RUNTIME,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_BUILD_ID,
  });

  console.error(JSON.stringify(record));

  // No-ops when Sentry was not initialized (missing DSN).
  Sentry.captureRequestError(error, request, context);
};
