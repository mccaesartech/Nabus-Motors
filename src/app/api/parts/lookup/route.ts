import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PublishedPart } from "@/lib/data/parts";

const LOOKUP_TIMEOUT_MS = 5_000;

type PartRow = Omit<PublishedPart, "parts_categories"> & {
  parts_categories: PublishedPart["parts_categories"] | PublishedPart["parts_categories"][];
};

function normalizePart(row: PartRow): PublishedPart {
  const cat = row.parts_categories;
  const category = Array.isArray(cat) ? (cat[0] ?? null) : cat;
  return { ...row, parts_categories: category };
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), LOOKUP_TIMEOUT_MS)
    ),
  ]);
}

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ parts: [] });
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ parts: [] });
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ parts: [] });
  }

  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from("parts")
          .select(
            "id, name, slug, sku, description, price_usd, brand, compatible_makes, compatible_models, images, stock_quantity, is_featured, category_id, parts_categories(id, name, slug, description)"
          )
          .eq("status", "published")
          .in("id", ids)
      ),
      "parts lookup"
    );

    if (error || !data) {
      return NextResponse.json({ parts: [] });
    }

    const parts = (data as PartRow[]).map(normalizePart);
    return NextResponse.json(
      { parts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json({ parts: [] });
  }
}
