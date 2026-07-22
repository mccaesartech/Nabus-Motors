export type RequestErrorRecord = {
  event: "next_request_error";
  digest: string | null;
  method: string;
  route: string;
  routeType: string;
  runtime: string;
  environment: string;
  release: string;
};

type RequestErrorInput = {
  digest?: string;
  method: string;
  routePath: string;
  routeType: string;
  runtime?: string;
  environment?: string;
  release?: string;
};

export function buildRequestErrorRecord(
  input: RequestErrorInput
): RequestErrorRecord {
  return {
    event: "next_request_error",
    digest: input.digest?.slice(0, 128) || null,
    method: input.method.slice(0, 16),
    route: input.routePath.slice(0, 256),
    routeType: input.routeType.slice(0, 32),
    runtime: input.runtime?.slice(0, 32) || "unknown",
    environment: input.environment?.slice(0, 32) || "unknown",
    release: input.release?.slice(0, 64) || "unknown",
  };
}
