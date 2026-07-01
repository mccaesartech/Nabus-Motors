/**
 * Generates supabase/seed-vehicles.sql from the in-app inventory generator.
 * Run: npx tsx scripts/generate-supabase-seed.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateInventory } from "../src/lib/data/generate-inventory";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function pgArray(values: string[]): string {
  if (values.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${values.map((v) => `'${sqlEscape(v)}'`).join(",")}]`;
}

function pgJson(value: unknown): string {
  return `'${sqlEscape(JSON.stringify(value))}'::jsonb`;
}

const vehicles = generateInventory();
const rows = vehicles.map((v) => {
  const cols = [
    `'${sqlEscape(v.slug)}'`,
    `'${sqlEscape(v.make)}'`,
    `'${sqlEscape(v.model)}'`,
    String(v.year),
    v.trim ? `'${sqlEscape(v.trim)}'` : "NULL",
    String(v.price),
    String(v.mileage),
    `'${sqlEscape(v.fuelType)}'`,
    `'${sqlEscape(v.transmission)}'`,
    `'${sqlEscape(v.condition)}'`,
    `'${sqlEscape(v.bodyType)}'`,
    `'${sqlEscape(v.location)}'`,
    `'${sqlEscape(v.engineSize)}'`,
    `'${sqlEscape(v.color)}'`,
    `'${sqlEscape(v.vin)}'`,
    `'${sqlEscape(v.description)}'`,
    v.featured ? "TRUE" : "FALSE",
    pgArray(v.images),
    pgJson(v.specs),
    pgJson(v.history),
    "'available'",
  ];
  return `  (${cols.join(", ")})`;
});

const sql = `-- Auto-generated: ${vehicles.length} vehicles (${new Date().toISOString().slice(0, 10)})
-- Run after supabase/setup.sql in Supabase SQL Editor

INSERT INTO vehicles (
  slug, make, model, year, trim, price, mileage,
  fuel_type, transmission, condition, body_type, location,
  engine_size, color, vin, description, featured, images, specs, history, status
)
VALUES
${rows.join(",\n")}
ON CONFLICT (slug) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  trim = EXCLUDED.trim,
  price = EXCLUDED.price,
  mileage = EXCLUDED.mileage,
  fuel_type = EXCLUDED.fuel_type,
  transmission = EXCLUDED.transmission,
  condition = EXCLUDED.condition,
  body_type = EXCLUDED.body_type,
  location = EXCLUDED.location,
  engine_size = EXCLUDED.engine_size,
  color = EXCLUDED.color,
  vin = EXCLUDED.vin,
  description = EXCLUDED.description,
  featured = EXCLUDED.featured,
  images = EXCLUDED.images,
  specs = EXCLUDED.specs,
  history = EXCLUDED.history,
  status = EXCLUDED.status,
  updated_at = NOW();
`;

const out = resolve(process.cwd(), "supabase/seed-vehicles.sql");
writeFileSync(out, sql, "utf8");
console.log(`Wrote ${vehicles.length} vehicles to ${out}`);
