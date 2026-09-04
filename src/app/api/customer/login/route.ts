import { NextResponse } from "next/server";
import { getExternalLoginUrl } from "@/lib/customer/external-auth";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Authentication is handled by auth.nabusmotors.com.",
      loginUrl: getExternalLoginUrl(),
    },
    { status: 410 }
  );
}
