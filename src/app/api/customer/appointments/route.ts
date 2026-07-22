import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CustomerAppointmentSummary } from "@/lib/account/types";
import { userOrEmailFilter } from "@/lib/security/postgrest-filter";

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, appointments: [] });
  }

  const email = user.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("vehicle_appointments")
    .select(
      "id, status, preferred_date, preferred_time, branch, created_at, order_id, vehicle_id, vehicle_ids"
    )
    .or(userOrEmailFilter(user.id, email))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: true, appointments: [] });
  }

  const vehicleIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.vehicle_id) vehicleIds.add(row.vehicle_id);
    const ids = row.vehicle_ids as Array<{ id?: string }> | null;
    if (Array.isArray(ids)) {
      for (const entry of ids) {
        if (entry?.id) vehicleIds.add(entry.id);
      }
    }
  }

  const nameById = new Map<string, string>();
  if (vehicleIds.size > 0) {
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, year, make, model, trim")
      .in("id", [...vehicleIds]);

    for (const v of vehicles ?? []) {
      const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ").trim();
      nameById.set(v.id, label || "Vehicle");
    }
  }

  const appointments: CustomerAppointmentSummary[] = (data ?? []).map((row) => {
    const names: string[] = [];
    const ids = row.vehicle_ids as Array<{ id?: string; name?: string }> | null;

    if (Array.isArray(ids)) {
      for (const entry of ids) {
        const label =
          entry.name?.trim() ||
          (entry.id ? nameById.get(entry.id) : undefined) ||
          "Vehicle";
        if (!names.includes(label)) names.push(label);
      }
    }

    if (row.vehicle_id) {
      const label = nameById.get(row.vehicle_id) ?? "Vehicle";
      if (!names.includes(label)) names.unshift(label);
    }

    return {
      id: row.id,
      status: row.status,
      preferred_date: row.preferred_date ?? null,
      preferred_time: row.preferred_time ?? null,
      branch: row.branch ?? null,
      created_at: row.created_at,
      order_id: row.order_id ?? null,
      vehicle_names: names,
    };
  });

  return NextResponse.json({ ok: true, appointments });
}
