import { NextResponse } from "next/server";
import { evaluateReadiness } from "@/lib/health/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = await evaluateReadiness();
  return NextResponse.json(
    {
      status: readiness.ready ? "ready" : "not_ready",
      release: readiness.release,
    },
    {
      status: readiness.ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    }
  );
}
