"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  PUBLIC_UNEXPECTED_ERROR_MESSAGE,
  publicErrorReference,
} from "@/lib/errors/public-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const errorReference = publicErrorReference(error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#1E1B2E",
          color: "#F5F3FF",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#C4B5FD", fontSize: "0.875rem", margin: "0 0 1rem" }}>
            {PUBLIC_UNEXPECTED_ERROR_MESSAGE}
          </p>
          {errorReference ? (
            <p
              style={{
                color: "#7C6B9E",
                fontSize: "0.75rem",
                margin: "0 0 1.5rem",
                wordBreak: "break-word",
              }}
            >
              {errorReference}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                background: "#8B5CF6",
                color: "#FFFFFF",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #4C3B6B",
                background: "transparent",
                color: "#F5F3FF",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
