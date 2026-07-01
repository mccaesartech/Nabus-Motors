"use client";

import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { PaymentStatusBadge } from "@/components/platform/status-badge";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { parsePreorderMetadata } from "@/lib/platform/preorder";
import type { AdminNotification } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

type PreorderNotificationPreviewProps = {
  notification: AdminNotification;
  variant?: "compact" | "full";
  className?: string;
};

export function PreorderNotificationPreview({
  notification,
  variant = "compact",
  className,
}: PreorderNotificationPreviewProps) {
  const { formatPrice } = usePlatformCurrency();
  const meta = parsePreorderMetadata(notification.metadata);
  const isPreorder = notification.type === "preorder" && meta;

  const downPaymentLabel =
    meta?.downPaymentUsd != null && meta.downPaymentUsd > 0
      ? formatPrice(meta.downPaymentUsd)
      : meta?.downPaymentFormatted;

  if (!isPreorder) {
    return (
      <p
        className={cn(
          variant === "compact"
            ? "mt-0.5 truncate text-xs text-[var(--platform-text-secondary)]"
            : "mt-1 text-sm text-[var(--platform-text-secondary)]",
          className
        )}
      >
        {notification.message}
      </p>
    );
  }

  const { customer, vehicle } = meta;
  const thumb = vehicle?.image;
  const title = vehicle?.title ?? notification.title.replace(/^Pre-order:\s*/i, "");

  if (variant === "full") {
    return (
      <div
        className={cn(
          "mt-2 flex flex-col gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3 sm:flex-row",
          className
        )}
      >
        <div className="relative mx-auto size-20 shrink-0 overflow-hidden rounded-md bg-[var(--platform-card)] sm:mx-0 sm:size-16">
          <SafeVehicleImage src={thumb} alt={title} fill className="object-cover" />
        </div>
        <div className="min-w-0 space-y-1.5 text-sm text-[var(--platform-text-secondary)]">
          <p className="font-medium leading-snug text-[var(--platform-text)]">{title}</p>
          <p className="break-words leading-relaxed">
            {customer?.name}
            {customer?.email ? (
              <>
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{customer.email}</span>
              </>
            ) : null}
            {customer?.phone ? (
              <>
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{customer.phone}</span>
              </>
            ) : null}
          </p>
          {downPaymentLabel && <p>Down payment: {downPaymentLabel}</p>}
          {customer?.message && (
            <p className="line-clamp-3 italic leading-relaxed">&ldquo;{customer.message}&rdquo;</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mt-1 flex items-start gap-2.5", className)}>
      <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-[var(--platform-bg)]">
        <SafeVehicleImage src={thumb} alt={title} width={36} height={36} fill={false} />
      </div>
      <p className="min-w-0 text-xs leading-relaxed text-[var(--platform-text-secondary)] line-clamp-2">
        {customer?.name}
        {title ? ` · ${title}` : ""}
        {downPaymentLabel ? ` · ${downPaymentLabel} down` : ""}
      </p>
    </div>
  );
}
