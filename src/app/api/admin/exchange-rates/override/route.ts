import { NextRequest, NextResponse } from "next/server";
import { requireFinanceAccess } from "@/lib/admin/auth";
import { enqueueAuditLog } from "@/lib/audit/write";
import { isValidCurrencyCode } from "@/lib/currency/codes";
import { isFxEntityType } from "@/lib/currency/snapshot";
import { loadFxSnapshot, overrideFxSnapshot } from "@/lib/currency/snapshot-server";
import { FX_MANUAL_LABEL } from "@/lib/currency/meta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireFinanceAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const entityType = req.nextUrl.searchParams.get("entityType") ?? "";
  const entityId = req.nextUrl.searchParams.get("entityId") ?? "";
  if (!isFxEntityType(entityType) || !entityId) {
    return NextResponse.json(
      { ok: false, message: "entityType and entityId are required." },
      { status: 400 }
    );
  }

  const snapshot = await loadFxSnapshot(entityType, entityId);
  return NextResponse.json({ ok: true, snapshot, label: snapshot ? FX_MANUAL_LABEL : null });
}

export async function POST(req: NextRequest) {
  const auth = await requireFinanceAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }

  const entityType = String(body.entityType ?? "");
  const entityId = String(body.entityId ?? "").trim();
  const rateUsed = Number(body.rateUsed);
  const reason = String(body.reason ?? "");
  const originalAmountUsd = Number(body.originalAmountUsd);
  const targetCurrency = String(body.targetCurrency ?? "GHS").toUpperCase();

  if (!isFxEntityType(entityType) || !entityId) {
    return NextResponse.json(
      { ok: false, message: "A document type and id are required." },
      { status: 400 }
    );
  }
  if (!isValidCurrencyCode(targetCurrency)) {
    return NextResponse.json({ ok: false, message: "Invalid currency code." }, { status: 400 });
  }
  if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
    return NextResponse.json(
      { ok: false, message: "Override rate must be a positive number." },
      { status: 400 }
    );
  }

  const result = await overrideFxSnapshot({
    entityType,
    entityId,
    rateUsed,
    reason,
    actorId: auth.auth.type === "user" ? auth.auth.userId ?? null : "owner",
    actorName: auth.auth.name,
    originalAmountUsd: Number.isFinite(originalAmountUsd) ? originalAmountUsd : undefined,
  });

  enqueueAuditLog({
    action: "fx_rate_override",
    success: result.ok,
    actor: auth.auth,
    targetType: entityType,
    targetId: entityId,
    request: req,
    errorMessage: result.ok ? null : result.message,
    metadata: {
      rateUsed,
      reason,
      label: FX_MANUAL_LABEL,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    snapshot: result.snapshot,
    label: FX_MANUAL_LABEL,
  });
}
