"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { adminLoginPath } from "@/lib/admin/paths";

type InquiryData = {
  contact?: Record<string, unknown>[];
  finance?: Record<string, unknown>[];
  appraisal?: Record<string, unknown>[];
  vehicle?: Record<string, unknown>[];
  newsletter?: Record<string, unknown>[];
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<InquiryData | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<keyof InquiryData>("contact");

  useEffect(() => {
    fetch("/api/admin/inquiries")
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          router.push(adminLoginPath());
          return;
        }
        setMessage(json.message ?? "");
        setData(json.data ?? {});
      });
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(adminLoginPath());
    router.refresh();
  }

  const tabs = [
    { key: "contact" as const, label: "Contact" },
    { key: "vehicle" as const, label: "Vehicle / Rental" },
    { key: "finance" as const, label: "Financing" },
    { key: "appraisal" as const, label: "Sell / Appraisal" },
    { key: "newsletter" as const, label: "Newsletter" },
  ];

  const rows = data?.[tab] ?? [];

  return (
    <div className="min-h-screen bg-brand-black py-10 text-white">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Customer inquiries, bookings, sales leads, and financing applications.
            </p>
          </div>
          <Button variant="luxury" onClick={logout}>
            Sign Out
          </Button>
        </div>

        {message && (
          <p className="mt-4 rounded border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-brand-gold">
            {message}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                tab === t.key
                  ? "bg-brand-purple text-white"
                  : "bg-white/10 text-white/70 hover:text-brand-gold"
              }`}
            >
              {t.label} ({data?.[t.key]?.length ?? 0})
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-brand-charcoal text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-secondary">
                    No records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={String(row.id)} className="border-t border-white/10">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {String(row.created_at ?? row.subscribed_at ?? "").slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <pre className="max-w-xl overflow-x-auto whitespace-pre-wrap font-sans text-xs text-white/90">
                        {JSON.stringify(row, null, 0).slice(0, 280)}
                      </pre>
                    </td>
                    <td className="px-4 py-3">{String(row.status ?? "active")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Container>
    </div>
  );
}
