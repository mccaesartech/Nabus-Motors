"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/page-header";
import { StatusBadge } from "@/components/platform/status-badge";
import { VisualShipmentTimeline } from "@/components/shared/visual-shipment-timeline";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import { type ShipmentTrackingRow } from "@/lib/platform/shipment";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

export default function FreightOrdersPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<ShipmentTrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/freight/shipments?reference_type=freight");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setShipments(json.shipments ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading freight orders…</p>;
  }

  const active = shipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
  const delivered = shipments.filter((s) => s.status === "delivered");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freight Orders"
        description="Active freight shipments and bookings converted from quote requests."
        breadcrumb="FREIGHT · Orders"
        actions={
          <>
            <Link href={platformPath("freight/quotes")} className="platform-btn-ghost">
              Quote requests
            </Link>
            <Link
              href={`${platformPath("freight/tracking")}?create=1`}
              className="platform-btn-primary inline-flex items-center gap-2"
            >
              <Plus className="size-4" />
              New shipment
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active orders"
          value={active.length}
          change="In progress shipments"
          onClick={() => router.push(platformPath("freight/tracking"))}
        />
        <StatCard
          label="Delivered"
          value={delivered.length}
          change="Completed freight orders"
          changeTone="positive"
          onClick={() => router.push(platformPath("freight/tracking"))}
        />
        <StatCard
          label="Quote pipeline"
          value="—"
          change="Review inbound quote requests"
          onClick={() => router.push(platformPath("freight/quotes"))}
        />
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="flex items-center justify-between border-b border-[var(--platform-border)] px-5 py-4">
          <h2 className="text-sm font-semibold">Active freight orders</h2>
          <Link
            href={platformPath("freight/tracking")}
            className="text-xs text-[var(--platform-accent)] hover:underline"
          >
            Open tracking manager
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="px-4 py-3 font-medium">Tracking #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Est. arrival</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--platform-text-secondary)]">
                    No active freight orders.{" "}
                    <Link href={platformPath("freight/quotes")} className="text-[var(--platform-accent)] hover:underline">
                      Review quote requests
                    </Link>{" "}
                    or{" "}
                    <Link
                      href={`${platformPath("freight/tracking")}?create=1`}
                      className="text-[var(--platform-accent)] hover:underline"
                    >
                      create a shipment
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                active.map((row) => {
                  const isExpanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-t border-[var(--platform-border)]">
                        <td className="px-4 py-3 font-mono text-xs">{row.tracking_number}</td>
                        <td className="px-4 py-3">
                          <p>{row.customer_name ?? "—"}</p>
                          <p className="text-xs text-[var(--platform-text-secondary)]">
                            {row.customer_email ?? ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {row.origin_country ?? "—"} → {row.destination ?? "Ghana"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                          <PlatformDateTime value={row.created_at} className="text-xs" />
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                          {row.estimated_arrival ? (
                            <PlatformDateTime value={row.estimated_arrival} mode="date" className="text-xs" />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="platform-btn-ghost inline-flex items-center gap-1 text-xs"
                              onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                              Timeline
                            </button>
                            <Link
                              href={`${platformPath("freight/tracking")}?shipment=${encodeURIComponent(row.id)}`}
                              className="platform-btn-ghost inline-flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="size-3" />
                              Manage
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-[var(--platform-border)] bg-[var(--platform-surface)]">
                          <td colSpan={7} className="px-4 py-4">
                            <VisualShipmentTimeline
                              status={row.status}
                              trackingId={row.tracking_number}
                              referenceId={row.reference_id}
                              expectedArrival={row.estimated_arrival}
                              theme="platform"
                              size="mini"
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
