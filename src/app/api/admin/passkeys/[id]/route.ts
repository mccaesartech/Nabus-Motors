import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteUserPasskey, isWebAuthnEnabled } from "@/lib/admin/webauthn";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, context: RouteContext) {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: false, message: "Passkeys are not enabled." }, { status: 503 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (auth.auth.type !== "user" || !auth.auth.userId) {
    return NextResponse.json(
      { ok: false, message: "Only platform team accounts can manage passkeys." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const removed = await deleteUserPasskey(auth.auth.userId, id);
  if (!removed) {
    return NextResponse.json({ ok: false, message: "Passkey not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message: "Passkey removed." });
}
