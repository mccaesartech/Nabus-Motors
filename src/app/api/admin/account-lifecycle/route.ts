import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import {
  getAccountLifecycleAudit,
  getAccountLifecycleDetail,
  listAccountLifecycle,
  type AccountLifecycleTab,
} from "@/lib/platform/account-lifecycle-admin";
import { logAdminViewedDeletionRequest, parseClientIp } from "@/lib/customer/account-lifecycle";

const VALID_TABS: AccountLifecycleTab[] = [
  "active",
  "suspended",
  "pending_deletion",
  "archived",
];

export async function GET(req: NextRequest) {
  const authResult = await requirePermission("account_lifecycle");
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const tab = (req.nextUrl.searchParams.get("tab") ?? "pending_deletion") as AccountLifecycleTab;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const userId = req.nextUrl.searchParams.get("userId") ?? undefined;

  if (!VALID_TABS.includes(tab)) {
    return NextResponse.json({ ok: false, message: "Invalid tab." }, { status: 400 });
  }

  if (userId) {
    const account = await getAccountLifecycleDetail(userId);
    if (!account) {
      return NextResponse.json({ ok: false, message: "Account not found." }, { status: 404 });
    }

    if (account.account_status === "pending_deletion" && authResult.auth.userId) {
      await logAdminViewedDeletionRequest(
        userId,
        authResult.auth.userId,
        parseClientIp(req)
      );
    }

    const audit = await getAccountLifecycleAudit(userId);
    return NextResponse.json({ ok: true, account, audit });
  }

  const accounts = await listAccountLifecycle(tab, search);
  return NextResponse.json({ ok: true, accounts, tab });
}
