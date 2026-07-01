import { NextRequest, NextResponse } from "next/server";
import { canDeleteCustomer, requireAdmin, requirePermission } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteAdminCustomer, fetchAdminCustomerDetail } from "@/lib/platform/customers-admin";
import { buildEntityLabel, recordTrashEntry } from "@/lib/platform/trash";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requirePermission("customers");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, message: "Customer id is required." }, { status: 400 });
  }

  const showDeleted = canDeleteCustomer(auth.auth);

  try {
    const customer = await fetchAdminCustomerDetail(supabase, id, {
      includeDeleted: showDeleted,
    });
    if (!customer) {
      return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load customer.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canDeleteCustomer(auth.auth)) {
    return NextResponse.json(
      { ok: false, message: "Only the owner can delete customers." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, message: "Customer id is required." }, { status: 400 });
  }

  try {
    const customer = await fetchAdminCustomerDetail(supabase, id, { includeDeleted: false });
    if (!customer) {
      return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
    }

    const snapshot = {
      email: customer.email,
      name: customer.name,
      userId: customer.userId,
      profile: customer.userId
        ? {
            id: customer.userId,
            email: customer.email,
            first_name: customer.name.split(/\s+/)[0] ?? customer.name,
            last_name: customer.name.split(/\s+/).slice(1).join(" ") || null,
            phone: customer.phone,
          }
        : null,
    };

    const result = await deleteAdminCustomer(supabase, id, auth.auth.email);
    if (!result.ok) {
      const status = result.message === "Customer not found." ? 404 : 400;
      return NextResponse.json({ ok: false, message: result.message }, { status });
    }

    const entityId = customer.userId ?? `email:${customer.email.toLowerCase()}`;
    const entityLabel = buildEntityLabel("customer", {
      first_name: customer.name.split(/\s+/)[0],
      last_name: customer.name.split(/\s+/).slice(1).join(" "),
      email: customer.email,
    });

    await recordTrashEntry(supabase, auth.auth, "customer", entityId, entityLabel, snapshot);

    await logPlatformActivity(auth.auth, "customer_deleted", result.email, {
      customerName: result.name,
      customerId: decodeURIComponent(id),
    });

    return NextResponse.json({
      ok: true,
      message: `${result.name} has been removed from the customer directory.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete customer.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
