import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      release:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
        process.env.NEXT_PUBLIC_BUILD_ID?.slice(0, 40) ||
        "unknown",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    }
  );
}
