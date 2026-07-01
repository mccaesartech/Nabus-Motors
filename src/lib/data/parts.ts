import "server-only";
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export type PartCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type PublishedPart = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price_usd: number | null;
  brand: string | null;
  compatible_makes: string[];
  compatible_models: string[];
  images: string[];
  stock_quantity: number;
  is_featured: boolean;
  category_id: string | null;
  parts_categories: PartCategory | null;
};

type PartRow = Omit<PublishedPart, "parts_categories"> & {
  parts_categories: PartCategory | PartCategory[] | null;
};

function normalizePart(row: PartRow): PublishedPart {
  const cat = row.parts_categories;
  const category = Array.isArray(cat) ? (cat[0] ?? null) : cat;
  return { ...row, parts_categories: category };
}

export type PartsFilter = {
  q?: string;
  category?: string;
  brand?: string;
  make?: string;
};

export async function loadPublishedParts(filter: PartsFilter = {}): Promise<PublishedPart[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];

  let categoryId: string | null = null;
  if (filter.category?.trim()) {
    const { data: cat } = await supabase
      .from("parts_categories")
      .select("id")
      .eq("slug", filter.category.trim())
      .eq("is_active", true)
      .maybeSingle();
    categoryId = cat?.id ?? "__none__";
  }

  let query = supabase
    .from("parts")
    .select(
      "id, name, slug, sku, description, price_usd, brand, compatible_makes, compatible_models, images, stock_quantity, is_featured, category_id, parts_categories(id, name, slug, description)"
    )
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (filter.brand?.trim()) {
    query = query.ilike("brand", `%${filter.brand.trim()}%`);
  }

  if (filter.make?.trim()) {
    query = query.contains("compatible_makes", [filter.make.trim()]);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let parts = (data as PartRow[]).map(normalizePart);

  if (filter.q?.trim()) {
    const q = filter.q.trim().toLowerCase();
    parts = parts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.brand?.toLowerCase().includes(q) ?? false)
    );
  }

  return parts;
}

export async function loadPartCategories(): Promise<PartCategory[]> {
  return getCachedPartCategories();
}

async function loadPartCategoriesUncached(): Promise<PartCategory[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("parts_categories")
    .select("id, name, slug, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as PartCategory[];
}

const getCachedPartCategories = unstable_cache(
  loadPartCategoriesUncached,
  ["parts-categories"],
  { revalidate: 60 }
);

export async function loadPublishedPartBySlug(slug: string): Promise<PublishedPart | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("parts")
    .select(
      "id, name, slug, sku, description, price_usd, brand, compatible_makes, compatible_models, images, stock_quantity, is_featured, category_id, parts_categories(id, name, slug, description)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return normalizePart(data as PartRow);
}
