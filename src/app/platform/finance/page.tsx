"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Trash2 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/page-header";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { isAdminAuthError } from "@/lib/admin/client";
import { canViewFinance } from "@/lib/platform/permissions";
import { canDirectMutate } from "@/lib/platform/mutation-approval";
import { platformPath } from "@/lib/platform/paths";
import type { ExpenseRow } from "@/lib/platform/modules";
import { downloadCsv } from "@/lib/platform/data";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type FinanceSummary = {
  soldRevenue: number;
  preorderRevenue: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
};

export default function FinancePage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canMutate = session ? canDirectMutate(session.role) : false;
  const financeVisible = session ? canViewFinance(session.role) : false;
  const { formatPrice } = usePlatformCurrency();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/expenses");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setExpenses(json.expenses ?? []);
    setSummary(json.summary ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (session && !financeVisible) {
      router.replace(platformPath("dashboard"));
    }
  }, [session, financeVisible, router]);

  useEffect(() => {
    if (!financeVisible) return;
    load();
  }, [load, financeVisible]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        amount_usd: Number(amount),
        expense_date: expenseDate,
      }),
    });
    if (res.ok) {
      setDescription("");
      setAmount("");
      setToast("Expense added.");
      load();
    }
  }

  async function removeExpense(id: string) {
    const res = await fetch(`/api/admin/expenses?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  function exportFinanceCsv() {
    const headers = ["description", "amount_usd", "expense_date"];
    const lines = [
      headers.join(","),
      ...expenses.map((e) =>
        [e.description, e.amount_usd, e.expense_date]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const summaryLines = [
      "",
      "metric,value",
      `sold_revenue,${summary?.soldRevenue ?? 0}`,
      `preorder_revenue,${summary?.preorderRevenue ?? 0}`,
      `total_revenue,${summary?.totalRevenue ?? 0}`,
      `total_expenses,${summary?.totalExpenses ?? 0}`,
      `profit,${summary?.profit ?? 0}`,
    ];
    downloadCsv(
      `true-goshen-finance-${new Date().toISOString().slice(0, 10)}.csv`,
      [...lines, ...summaryLines].join("\n")
    );
  }

  if (session && !financeVisible) {
    return null;
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading finance…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Revenue from sales and pre-orders, expense tracking, and profit summary."
        breadcrumb="Finance"
        actions={
          <button type="button" onClick={exportFinanceCsv} className="platform-btn-ghost">
            <Download className="size-4" />
            Export CSV
          </button>
        }
      />

      {toast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]">
          {toast}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sold revenue" value={formatPrice(summary?.soldRevenue ?? 0)} />
        <StatCard label="Pre-order deposits" value={formatPrice(summary?.preorderRevenue ?? 0)} />
        <StatCard label="Total expenses" value={formatPrice(summary?.totalExpenses ?? 0)} />
        <StatCard
          label="Net profit"
          value={formatPrice(summary?.profit ?? 0)}
          changeTone={(summary?.profit ?? 0) >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="border-b border-[var(--platform-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--platform-text)]">Expenses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="platform-table w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[var(--platform-text-secondary)]">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[var(--platform-text-secondary)]">
                      No expenses recorded yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="px-4 py-3">{expense.description}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPrice(expense.amount_usd)}</td>
                      <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={expense.expense_date} mode="date" className="text-xs" />
                      </td>
                      <td className="px-4 py-3">
                        {canMutate ? (
                          <button
                            type="button"
                            onClick={() => removeExpense(expense.id)}
                            className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canMutate ? (
        <form onSubmit={addExpense} className="platform-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Add expense</h2>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Description</span>
            <input
              required
              className="platform-input w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Amount</span>
            <input
              required
              type="number"
              min="1"
              step="1"
              className="platform-input w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--platform-text-secondary)]">Date</span>
            <input
              required
              type="date"
              className="platform-input platform-input--date w-full"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </label>
          <button type="submit" className="platform-btn-primary w-full">
            <Plus className="size-4" />
            Add expense
          </button>
        </form>
        ) : (
          <div className="platform-card rounded-xl p-5 text-sm text-[var(--platform-text-secondary)]">
            Expense changes require Owner or Super Admin approval.
          </div>
        )}
      </div>
    </div>
  );
}
