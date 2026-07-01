import { cn } from "@/lib/utils";

import { availabilityLabel } from "@/lib/vehicles/availability";
import { APPROVAL_STATUS_LABELS } from "@/lib/admin/vehicle-approval";
import { paymentStatusLabel } from "@/lib/platform/preorder";
import { saleStatusLabel } from "@/lib/platform/sales";
import { StatusDot } from "@/components/platform/status-dot";

const STATUS_MAP: Record<string, string> = {
  available: "platform-badge-available",
  pre_order: "platform-badge-pre-order",
  reserved: "platform-badge-reserved",
  sold: "platform-badge-sold",
  new: "platform-badge-new",
  pending: "platform-badge-pending",
  contacted: "platform-badge-contacted",
  quoted: "platform-badge-contacted",
  qualified: "platform-badge-new",
  booked: "platform-badge-new",
  in_transit: "platform-badge-pending",
  at_port: "platform-badge-pending",
  clearing: "platform-badge-pending",
  delivered: "platform-badge-available",
  closed: "platform-badge-closed",
  active: "platform-badge-available",
  pending_approval: "platform-badge-pending",
  rejected: "platform-badge-closed",
  approved: "platform-badge-available",
};

const VEHICLE_STATUSES = new Set(["available", "pre_order", "reserved", "sold"]);

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase();
  const variant = STATUS_MAP[key] ?? "platform-badge-closed";
  const label =
    key === "pre_order" ? availabilityLabel("pre_order") : status;
  const showDot = VEHICLE_STATUSES.has(key);

  return (
    <span className={cn("platform-badge gap-1.5", variant, className)}>
      {showDot && <StatusDot status={key} />}
      {label}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="platform-badge platform-badge-closed capitalize">
      {source.replace(/-/g, " ")}
    </span>
  );
}

const PAYMENT_BADGE_MAP: Record<string, string> = {
  pending: "platform-badge-pending",
  down_payment_paid: "platform-badge-available",
  completed: "platform-badge-new",
  cancelled: "platform-badge-closed",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const variant = PAYMENT_BADGE_MAP[key] ?? "platform-badge-pending";
  return (
    <span className={cn("platform-badge", variant)}>
      {paymentStatusLabel(key)}
    </span>
  );
}

const SALE_BADGE_MAP: Record<string, string> = {
  draft: "platform-badge-closed",
  sent: "platform-badge-contacted",
  accepted: "platform-badge-available",
  completed: "platform-badge-sold",
};

export function SaleStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const variant = SALE_BADGE_MAP[key] ?? "platform-badge-pending";
  return (
    <span className={cn("platform-badge", variant)}>
      {saleStatusLabel(key)}
    </span>
  );
}

export function ApprovalStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase();
  const variant = STATUS_MAP[key] ?? "platform-badge-pending";
  const label =
    APPROVAL_STATUS_LABELS[key as keyof typeof APPROVAL_STATUS_LABELS] ??
    status.replace(/_/g, " ");

  return (
    <span className={cn("platform-badge", variant, className)}>
      {label}
    </span>
  );
}
