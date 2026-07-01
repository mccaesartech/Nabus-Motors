import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/site-content";

export const revalidate = 60;

export async function GET() {
  const content = await getSiteContent();

  return NextResponse.json(
    { ok: true, content },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
