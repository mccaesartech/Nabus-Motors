import { NextResponse } from "next/server";
import { getStaticFallbackRates } from "@/lib/currency/rates";

export const revalidate = 3600;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD";

export async function GET() {
  const fallbacks = getStaticFallbackRates();

  try {
    const res = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          rates: fallbacks,
          source: "fallback",
          fetchedAt: new Date().toISOString(),
        },
        { headers: CACHE_HEADERS }
      );
    }

    const data = (await res.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };

    const rates = {
      USD: 1,
      ...fallbacks,
      ...(data.rates ?? {}),
    };

    return NextResponse.json(
      {
        rates,
        source: "frankfurter",
        fetchedAt: data.date ?? new Date().toISOString(),
      },
      { headers: CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        rates: fallbacks,
        source: "fallback",
        fetchedAt: new Date().toISOString(),
      },
      { headers: CACHE_HEADERS }
    );
  }
}
