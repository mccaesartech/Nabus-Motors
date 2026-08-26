import { NextResponse } from "next/server";
import { EXCHANGE_RATE_CACHE_TTL_SECONDS } from "@/lib/currency/fetch-exchange-rates-constants";
import { getServerExchangeRates } from "@/lib/currency/server-rates";

export const revalidate = 1800;

const CACHE_HEADERS = {
  "Cache-Control": `public, s-maxage=${EXCHANGE_RATE_CACHE_TTL_SECONDS}, stale-while-revalidate=3600`,
};

export async function GET() {
  const payload = await getServerExchangeRates();

  return NextResponse.json(
    {
      rates: payload.rates,
      liveRates: payload.liveRates,
      ratesFromGhs: payload.ratesFromGhs,
      source: payload.source,
      stale: payload.stale,
      fetchedAt: payload.fetchedAt,
      rateDate: payload.rateDate,
      provider: payload.provider,
      error: payload.error,
      displayOverride: payload.displayOverride,
    },
    { headers: CACHE_HEADERS }
  );
}
