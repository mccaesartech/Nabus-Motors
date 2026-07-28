import "server-only";

import { logAppError, toAppError, type ErrorActor } from "./logger";

/**
 * Result shape for Server Actions. Mirrors the API failure shape so a form can
 * render either without branching.
 *
 * No Server Actions exist yet (all mutations go through route handlers); this
 * is the sanctioned entry point when one is added.
 */
export type ActionResult<T> =
  | { ok: true; success: true; data: T }
  | { ok: false; success: false; message: string; errorId: string };

export type ActionErrorOptions = {
  module: string;
  message?: string;
  actor?: ErrorActor | null;
  input?: unknown;
};

/** Run a Server Action body, converting any throw into a safe result. */
export async function runServerAction<T>(
  options: ActionErrorOptions,
  body: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, success: true, data: await body() };
  } catch (error) {
    const appError = toAppError(error, options.message);
    const errorId = logAppError({
      error: appError,
      module: options.module,
      userMessage: appError.userMessage,
      kind: appError.kind,
      status: appError.status,
      requestBody: options.input,
      actor: options.actor ?? null,
      dbCode: appError.dbCode,
    });

    return { ok: false, success: false, message: appError.userMessage, errorId };
  }
}
