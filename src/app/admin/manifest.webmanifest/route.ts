import { NextResponse } from "next/server";
import { buildAdminManifest } from "@/lib/pwa/manifest";

export const dynamic = "force-static";
export const revalidate = false;

export async function GET() {
  return NextResponse.json(buildAdminManifest(), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
