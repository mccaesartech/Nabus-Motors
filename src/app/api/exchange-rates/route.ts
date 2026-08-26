import { NextResponse } from "next/server";
import {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  fetchLiveExchangeRates,
} from "@/lib/currency/fetch-exchange-rates";

export const revalidate = EXCHANGE_RATE_CACHE_TTL_SECONDS;

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
