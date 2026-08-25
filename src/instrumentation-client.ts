import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
const replayEnabled =
  process.env.NEXT_PUBLIC_SENTRY_REPLAY === "1" ||
  process.env.NEXT_PUBLIC_SENTRY_REPLAY === "true";

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_BUILD_ID,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: replayEnabled ? 0.05 : 0,
  replaysOnErrorSampleRate: replayEnabled ? 1.0 : 0,
  integrations: replayEnabled
    ? [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ]
    : [],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
