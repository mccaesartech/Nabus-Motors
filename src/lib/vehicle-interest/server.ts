import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import { ROUTES } from "@/lib/routes";
import { getAutoSiteUrl } from "@/lib/site-url";
import type { VehicleInterestActivityType, VehicleInterestStats } from "./types";

export type RecordVehicleInterestInput = {
  vehicleId: string;
  activityType: VehicleInterestActivityType;
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export async function recordVehicleInterest(
  supabase: SupabaseClient,
  input: RecordVehicleInterestInput
): Promise<void> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const userId = input.userId ?? null;

  if (!userId && !email) return;

  await supabase.from("vehicle_interest").insert({
    vehicle_id: input.vehicleId,
    user_id: userId,
    email,
    phone,
    activity_type: input.activityType,
  });
}

export async function syncPendingVehicleInterest(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  phone: string | null | undefined,
  pending: Array<{
    vehicle_id: string;
    activity_type: VehicleInterestActivityType;
    email?: string | null;
    phone?: string | null;
  }>
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  for (const row of pending) {
    if (!row.vehicle_id || !row.activity_type) continue;
    await recordVehicleInterest(supabase, {
      vehicleId: row.vehicle_id,
      activityType: row.activity_type,
      userId,
      email: row.email?.trim().toLowerCase() || normalizedEmail,
      phone: row.phone?.trim() || phone || null,
    });
  }
}

type InterestedRecipient = {
  email: string;
  phone: string | null;
  name: string | null;
  userId: string | null;
};

function addRecipient(
  map: Map<string, InterestedRecipient>,
  email: string,
  patch: Partial<InterestedRecipient>
) {
  const key = email.trim().toLowerCase();
  if (!key) return;
  const existing = map.get(key);
  map.set(key, {
    email: key,
    phone: patch.phone ?? existing?.phone ?? null,
    name: patch.name ?? existing?.name ?? null,
    userId: patch.userId ?? existing?.userId ?? null,
  });
}

export async function collectInterestedRecipients(
  supabase: SupabaseClient,
  vehicleId: string
): Promise<InterestedRecipient[]> {
  const map = new Map<string, InterestedRecipient>();

  const [interestRes, alertsRes, preordersRes] = await Promise.all([
    supabase
      .from("vehicle_interest")
      .select("email, phone, user_id")
      .eq("vehicle_id", vehicleId),
    supabase
      .from("price_alerts")
      .select("email, phone, user_id")
      .eq("vehicle_id", vehicleId)
      .eq("status", "active"),
    supabase
      .from("preorder_inquiries")
      .select("email, phone, user_id, name")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null),
  ]);

  const userIds = new Set<string>();

  for (const row of interestRes.data ?? []) {
    if (row.email) {
      addRecipient(map, row.email, {
        phone: row.phone,
        userId: row.user_id,
      });
    } else if (row.user_id) {
      userIds.add(row.user_id);
    }
  }

  for (const row of alertsRes.data ?? []) {
    if (row.email) {
      addRecipient(map, row.email, {
        phone: row.phone,
        userId: row.user_id,
      });
    } else if (row.user_id) {
      userIds.add(row.user_id);
    }
  }

  for (const row of preordersRes.data ?? []) {
    if (row.email) {
      addRecipient(map, row.email, {
        phone: row.phone,
        userId: row.user_id,
        name: row.name,
      });
    } else if (row.user_id) {
      userIds.add(row.user_id);
    }
  }

  if (userIds.size > 0) {
    const ids = [...userIds];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, email")
      .in("id", ids);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    ids.forEach((id) => {
        const profile = profileById.get(id);
        const email = profile?.email?.trim().toLowerCase();
        if (!email) return;
        const name = profile
          ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || null
          : null;
        addRecipient(map, email, {
          phone: profile?.phone ?? null,
          name,
          userId: id,
        });
      });
  }

  return [...map.values()];
}

export async function getVehicleInterestStats(
  supabase: SupabaseClient,
  vehicleId: string
): Promise<VehicleInterestStats> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [interestRes, alertsRes, preordersRes] = await Promise.all([
    supabase
      .from("vehicle_interest")
      .select("email, user_id, created_at")
      .eq("vehicle_id", vehicleId),
    supabase
      .from("price_alerts")
      .select("email")
      .eq("vehicle_id", vehicleId)
      .eq("status", "active"),
    supabase
      .from("preorder_inquiries")
      .select("email")
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null),
  ]);

  const emails = new Set<string>();
  let totalActivities = 0;
  let recentActivities = 0;

  for (const row of interestRes.data ?? []) {
    totalActivities += 1;
    if (row.created_at >= since) recentActivities += 1;
    if (row.email) emails.add(row.email.toLowerCase());
  }
  for (const row of alertsRes.data ?? []) {
    if (row.email) emails.add(row.email.toLowerCase());
  }
  for (const row of preordersRes.data ?? []) {
    if (row.email) emails.add(row.email.toLowerCase());
  }

  return {
    uniqueEmails: emails.size,
    totalActivities,
    recentActivities,
  };
}

/**
 * Notify active price_alerts subscribers when a vehicle's price drops.
 * Marks each alert as `notified` so the same drop is not re-sent.
 */
export async function notifyPriceDropSubscribers(
  supabase: SupabaseClient,
  vehicle: {
    id: string;
    slug: string;
    make: string;
    model: string;
    year: number;
    previousPrice: number;
    newPrice: number;
  }
): Promise<{ notified: number; skipped: number }> {
  if (
    !Number.isFinite(vehicle.newPrice) ||
    !Number.isFinite(vehicle.previousPrice) ||
    vehicle.newPrice >= vehicle.previousPrice
  ) {
    return { notified: 0, skipped: 0 };
  }

  const { data: alerts, error } = await supabase
    .from("price_alerts")
    .select("id, email, phone, user_id, price_usd_at_signup")
    .eq("vehicle_id", vehicle.id)
    .eq("status", "active");

  if (error || !alerts?.length) {
    return { notified: 0, skipped: 0 };
  }

  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const vehicleUrl = `${getAutoSiteUrl()}${ROUTES.auto.inventoryDetail(vehicle.slug)}`;
  const formatUsd = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  let notified = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const signupPrice = Number(alert.price_usd_at_signup);
    // Only notify if the new price is below what they signed up at.
    if (Number.isFinite(signupPrice) && vehicle.newPrice >= signupPrice) {
      skipped += 1;
      continue;
    }

    const email = alert.email?.trim().toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }

    try {
      await notifyCustomer({
        email,
        phone: alert.phone,
        template: "price_drop",
        data: {
          vehicleTitle,
          vehicleUrl,
          oldPrice: formatUsd(vehicle.previousPrice),
          newPrice: formatUsd(vehicle.newPrice),
        },
        sourceTable: "price_alerts",
        sourceId: alert.id,
      });

      await supabase
        .from("price_alerts")
        .update({ status: "notified" })
        .eq("id", alert.id);

      notified += 1;
    } catch (err) {
      console.warn(
        "[price-drop] notify failed (non-blocking):",
        err instanceof Error ? err.message : err
      );
      skipped += 1;
    }
  }

  return { notified, skipped };
}

export async function notifyVehicleLocallyAvailable(
  supabase: SupabaseClient,
  vehicle: {
    id: string;
    slug: string;
    make: string;
    model: string;
    year: number;
    local_availability_at: string;
  }
): Promise<{ notified: number; skipped: number }> {
  const recipients = await collectInterestedRecipients(supabase, vehicle.id);
  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const vehicleUrl = `${getAutoSiteUrl()}${ROUTES.auto.inventoryDetail(vehicle.slug)}`;
  const availabilityAt = vehicle.local_availability_at;

  let notified = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const { data: existing } = await supabase
      .from("vehicle_availability_notifications")
      .select("id")
      .eq("vehicle_id", vehicle.id)
      .eq("email", recipient.email)
      .eq("local_availability_at", availabilityAt)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    await notifyCustomer({
      email: recipient.email,
      phone: recipient.phone,
      customerName: recipient.name ?? undefined,
      template: "vehicle_available_locally",
      data: {
        vehicleTitle,
        vehicleUrl,
      },
      sourceTable: "vehicles",
      sourceId: vehicle.id,
    });

    await supabase.from("vehicle_availability_notifications").insert({
      vehicle_id: vehicle.id,
      email: recipient.email,
      local_availability_at: availabilityAt,
    });

    notified += 1;
  }

  return { notified, skipped };
}
