import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { enqueueAuditLog } from "@/lib/audit/write";
import { refreshServerExchangeRates } from "@/lib/currency/server-rates";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const payload = await refreshServerExchangeRates();

  enqueueAuditLog({
    action: "fx_rate_refresh",
    success: !payload.stale,
    actor: auth.auth,
    targetType: "exchange_rates",
    targetId: "usd",
    request: req,
    metadata: {
      source: payload.source,
      provider: payload.provider,
      stale: payload.stale,
      fetchedAt: payload.fetchedAt,
    },
  });

  return NextResponse.json({
    ok: true,
    rates: payload.rates,
    ratesFromGhs: payload.ratesFromGhs,
    source: payload.source,
    stale: payload.stale,
    fetchedAt: payload.fetchedAt,
    rateDate: payload.rateDate,
    provider: payload.provider,
    error: payload.error,
  });
}
