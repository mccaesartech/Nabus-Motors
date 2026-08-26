import { NextResponse } from "next/server";
import {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  fetchLiveExchangeRates,
} from "@/lib/currency/fetch-exchange-rates";

/** Must be a literal for Next.js segment config analysis. */
export const revalidate = 1800;

const CACHE_HEADERS = {
  "Cache-Control": `public, s-maxage=${EXCHANGE_RATE_CACHE_TTL_SECONDS}, stale-while-revalidate=3600`,
};

export async function GET() {
  const payload = await fetchLiveExchangeRates();

  return NextResponse.json(
    {
      rates: payload.rates,
      ratesFromGhs: payload.ratesFromGhs,
      source: payload.source,
      stale: payload.stale,
      fetchedAt: payload.fetchedAt,
      rateDate: payload.rateDate,
    },
    { headers: CACHE_HEADERS }
  );
}
