import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function insertRow(
  table: string,
  row: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerSupabase();

  if (!supabase) {
    console.info(`[inquiry:${table}]`, row);
    return { ok: true };
  }

  const { error } = await supabase.from(table).insert(row);

  if (error) {
    console.error(`[inquiry:${table}]`, error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function jsonOk(message = "Submitted successfully") {
  return NextResponse.json({ ok: true, message });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status });
}
