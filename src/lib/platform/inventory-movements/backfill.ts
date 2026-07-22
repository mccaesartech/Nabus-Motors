import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeletedFilter } from "@/lib/platform/trash";
import {
  recordExpenseMovement,
  recordOrderConfirmed,
  recordPreorderDeposit,
  recordVehicleReceived,
  recordVehicleSold,
} from "./record";

export async function backfillInventoryMovements(
  supabase: SupabaseClient
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  async function track(result: { ok: boolean; skipped?: boolean; error?: string }) {
    if (result.error) {
      errors.push(result.error);
      return;
    }
    if (result.skipped) skipped += 1;
    else if (result.ok) inserted += 1;
  }

  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vehicles")
    .select("id, year, make, model, price, created_at")
    .order("created_at", { ascending: true })
    .limit(2000);

  if (vehiclesError?.message.includes("does not exist")) {
    return { inserted: 0, skipped: 0, errors: ["inventory_movements table missing"] };
  }

  for (const vehicle of vehicles ?? []) {
    await track(
      await recordVehicleReceived(supabase, vehicle, null).then((r) => ({
        ...r,
        ...(r.skipped ? {} : { ok: r.ok }),
      }))
    );
    // Force backfill source
    if (!errors.length) {
      await supabase
        .from("inventory_movements")
        .update({ source: "backfill" })
        .eq("reference_type", "vehicles")
        .eq("reference_id", vehicle.id)
        .eq("movement_type", "vehicle_received");
    }
  }

  const { data: sales } = await supabase
    .from("sales")
    .select(
      `
      id, sale_price, sale_date, status, vehicle_id,
      vehicle:vehicles (id, year, make, model, price)
    `
    )
    .eq("status", "completed")
    .order("sale_date", { ascending: true })
    .limit(2000);

  for (const sale of sales ?? []) {
    const vehicle = Array.isArray(sale.vehicle) ? sale.vehicle[0] : sale.vehicle;
    if (!vehicle) continue;
    await track(
      await recordVehicleSold(
        supabase,
        {
          id: vehicle.id,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          price: vehicle.price,
        },
        {
          salePrice: sale.sale_price,
          saleId: sale.id,
          occurredAt: sale.sale_date ?? undefined,
          movementType: "sale_completed",
        }
      )
    );
    await supabase
      .from("inventory_movements")
      .update({ source: "backfill" })
      .eq("reference_type", "sales")
      .eq("reference_id", sale.id)
      .eq("movement_type", "sale_completed");
  }

  const { data: expenses } = await notDeletedFilter(
    supabase.from("expenses").select("id, description, amount_usd, expense_date")
  )
    .order("expense_date", { ascending: true })
    .limit(2000);

  for (const expense of expenses ?? []) {
    await track(await recordExpenseMovement(supabase, expense));
    await supabase
      .from("inventory_movements")
      .update({ source: "backfill" })
      .eq("reference_type", "expenses")
      .eq("reference_id", expense.id);
  }

  const { data: preorders } = await supabase
    .from("preorder_inquiries")
    .select("id, name, down_payment_usd, created_at, payment_status")
    .in("payment_status", ["down_payment_paid", "completed"])
    .gt("down_payment_usd", 0)
    .limit(2000);

  for (const preorder of preorders ?? []) {
    await track(await recordPreorderDeposit(supabase, preorder));
    await supabase
      .from("inventory_movements")
      .update({ source: "backfill" })
      .eq("reference_type", "preorder_inquiries")
      .eq("reference_id", preorder.id);
  }

  const { data: orders } = await supabase
    .from("parts_orders")
    .select("id, name, total_usd, confirmed_at, status")
    .in("status", ["confirmed", "shipped", "fulfilled"])
    .limit(2000);

  for (const order of orders ?? []) {
    await track(
      await recordOrderConfirmed(supabase, {
        id: order.id,
        name: order.name,
        totalUsd: order.total_usd,
        confirmedAt: order.confirmed_at,
      })
    );
    await supabase
      .from("inventory_movements")
      .update({ source: "backfill" })
      .eq("reference_type", "parts_orders")
      .eq("reference_id", order.id);
  }

  return { inserted, skipped, errors };
}

export function isMovementsTableMissing(errorMessage: string): boolean {
  return (
    errorMessage.includes("inventory_movements") &&
    (errorMessage.includes("does not exist") || errorMessage.includes("Could not find"))
  );
}
