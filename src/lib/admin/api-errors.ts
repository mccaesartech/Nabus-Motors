/** Map Supabase/Postgres errors to actionable admin messages. */
export function friendlyAdminDbError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("stock_quantity") &&
    (lower.includes("schema cache") ||
      lower.includes("does not exist") ||
      lower.includes("could not find"))
  ) {
    return "Database is missing stock_quantity. Run supabase/migrations/082_vehicle_stock_quantity.sql in the Supabase SQL Editor, then try again.";
  }

  if (
    lower.includes("gallery") &&
    (lower.includes("schema cache") || lower.includes("does not exist"))
  ) {
    return "Database is missing vehicle gallery columns. Run scripts/missing-columns-fix.sql in the Supabase SQL Editor, then try again.";
  }

  if (
    (lower.includes("primary_image_url") || lower.includes("additional_images")) &&
    (lower.includes("schema cache") || lower.includes("does not exist"))
  ) {
    return "Database is missing vehicle image columns. Run scripts/missing-columns-fix.sql in the Supabase SQL Editor, then try again.";
  }

  if (
    lower.includes("walkaround_video_url") &&
    (lower.includes("schema cache") || lower.includes("does not exist"))
  ) {
    return "Database is missing walkaround_video_url. Run scripts/missing-columns-fix.sql in the Supabase SQL Editor for full video support.";
  }

  if (lower.includes("site_content") && lower.includes("schema cache")) {
    return 'Database is missing the site_content table. Open Supabase Dashboard → SQL Editor, run supabase/migrations/015_site_content.sql, then try again.';
  }

  if (
    lower.includes("channel_type") &&
    (lower.includes("schema cache") ||
      lower.includes("does not exist") ||
      lower.includes("column"))
  ) {
    return "Group channels are temporarily unavailable. Direct messages still work.";
  }

  if (
    lower.includes("json object requested") ||
    lower.includes("pgrst116") ||
    lower.includes("0 rows")
  ) {
    return "Update did not apply. Confirm the vehicle still exists and SUPABASE_SERVICE_ROLE_KEY is the service role key (not the anon key).";
  }

  if (lower.includes("vehicles_status_check") || lower.includes("status_check")) {
    return "Invalid status. Choose Available, Pre-Order, Reserved, or Sold.";
  }

  if (
    lower.includes("vehicles_local_shipment_exclusive") ||
    (lower.includes("available_locally") &&
      lower.includes("shipment") &&
      lower.includes("check"))
  ) {
    return "Locally available stock cannot also be marked for shipment. Turn off “Shipment available” or “Available locally”, then save again.";
  }

  if (
    lower.includes("vehicles_country_of_origin_check") ||
    (lower.includes("country_of_origin") && lower.includes("check"))
  ) {
    return "Invalid country of origin. Choose Ghana, China, Japan, Other, or Not specified.";
  }

  if (lower.includes("vehicles_vin_key") || (lower.includes("duplicate key") && lower.includes("vin"))) {
    return "Another vehicle already uses this VIN. Leave VIN blank or use a unique value.";
  }

  if (lower.includes("invalid api key") || lower.includes("jwt")) {
    return "Supabase rejected the server API key. Check SUPABASE_SERVICE_ROLE_KEY on Vercel.";
  }

  return message;
}
