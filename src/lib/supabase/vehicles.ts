import type { Vehicle, VehicleSpec, HistoryEvent } from "@/lib/types";
import { vehicles as mockVehicles } from "@/lib/data/vehicles";
import { createServerSupabase } from "@/lib/supabase/server";

interface VehicleRow {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  condition: string;
  body_type: string;
  location: string;
  engine_size: string | null;
  color: string | null;
  vin: string | null;
  description: string | null;
  featured: boolean;
  images: string[];
  specs: VehicleSpec[];
  history: HistoryEvent[];
  created_at: string;
}

function mapRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    slug: row.slug,
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim ?? undefined,
    price: row.price,
    mileage: row.mileage,
    fuelType: row.fuel_type as Vehicle["fuelType"],
    transmission: row.transmission as Vehicle["transmission"],
    condition: row.condition as Vehicle["condition"],
    bodyType: row.body_type as Vehicle["bodyType"],
    location: row.location,
    engineSize: row.engine_size ?? "",
    color: row.color ?? "",
    vin: row.vin ?? "",
    description: row.description ?? "",
    featured: row.featured,
    images: row.images ?? [],
    specs: row.specs ?? [],
    history: row.history ?? [],
    createdAt: row.created_at.split("T")[0],
  };
}

export async function fetchAllVehicles(): Promise<Vehicle[]> {
  const supabase = createServerSupabase();

  if (!supabase) {
    return mockVehicles;
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    console.error("Supabase fetch failed, using mock data:", error?.message);
    return mockVehicles;
  }

  return data.map((row) => mapRow(row as VehicleRow));
}

export async function fetchVehicleBySlug(slug: string): Promise<Vehicle | null> {
  const supabase = createServerSupabase();

  if (!supabase) {
    return mockVehicles.find((v) => v.slug === slug) ?? null;
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "available")
    .single();

  if (error || !data) {
    return mockVehicles.find((v) => v.slug === slug) ?? null;
  }

  return mapRow(data as VehicleRow);
}

export async function fetchFeaturedVehicles(): Promise<Vehicle[]> {
  const all = await fetchAllVehicles();
  return all.filter((v) => v.featured);
}
