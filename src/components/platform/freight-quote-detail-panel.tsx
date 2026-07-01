import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { platformPath } from "@/lib/platform/paths";
import {
  formatFreightQuoteCargo,
  freightQuoteStatusLabel,
  freightServiceLabel,
  type FreightQuoteRow,
  whatsAppOptInLabel,
} from "@/lib/platform/freight-quote-display";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type DetailSectionProps = {
  title: string;
  children: React.ReactNode;
};

function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <div className="rounded-lg border border-[var(--platform-border)] bg-white/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
        {title}
      </h3>
      <dl className="mt-3 space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(8rem,30%)_1fr] sm:gap-3">
      <dt className="text-[var(--platform-text-secondary)]">{label}</dt>
      <dd className="font-medium text-[var(--platform-text)]">{value}</dd>
    </div>
  );
}

type FreightQuoteDetailPanelProps = {
  quote: FreightQuoteRow;
};

export function FreightQuoteDetailPanel({ quote }: FreightQuoteDetailPanelProps) {
  const cargo = formatFreightQuoteCargo(quote);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DetailSection title="Contact">
        <DetailRow label="Name" value={quote.name} />
        <DetailRow label="Email" value={quote.email} />
        <DetailRow label="Phone" value={quote.phone ?? "—"} />
        <DetailRow label="WhatsApp" value={whatsAppOptInLabel(quote.whatsapp_opt_in)} />
      </DetailSection>

      <DetailSection title="Cargo">
        <DetailRow label="Description" value={quote.cargo_description ?? "—"} />
        <DetailRow label="Size / details" value={quote.cargo_size ?? "—"} />
        {cargo && cargo !== quote.cargo_description && (
          <DetailRow label="Combined" value={cargo} />
        )}
        {quote.estimated_value_usd != null && (
          <DetailRow
            label="Est. value (USD)"
            value={`$${quote.estimated_value_usd.toLocaleString()}`}
          />
        )}
      </DetailSection>

      <DetailSection title="Route">
        <DetailRow label="Service" value={freightServiceLabel(quote.service_type)} />
        <DetailRow label="Origin" value={quote.origin_country ?? "—"} />
        <DetailRow label="Destination" value={quote.destination ?? "Ghana"} />
      </DetailSection>

      <DetailSection title="Account">
        <DetailRow
          label="Account linked"
          value={quote.user_id ? "Yes — registered customer" : "Guest submission"}
        />
        {quote.customer_registration_id && (
          <DetailRow
            label="Registration ID"
            value={<span className="font-mono text-xs">{quote.customer_registration_id}</span>}
          />
        )}
        {quote.user_id && (
          <DetailRow
            label="Customer profile"
            value={
              <Link
                href={platformPath(`customers/${encodeURIComponent(quote.user_id)}`)}
                className="text-[var(--platform-accent)] hover:underline"
              >
                View customer
              </Link>
            }
          />
        )}
        <DetailRow label="Source" value={quote.source ?? "website"} />
      </DetailSection>

      <DetailSection title="Reference">
        <DetailRow
          label="Quote reference"
          value={
            quote.reference_code ? (
              <span className="font-mono">{quote.reference_code}</span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow label="Status" value={freightQuoteStatusLabel(quote.status)} />
        <DetailRow
          label="Submitted"
          value={<PlatformDateTime value={quote.created_at} />}
        />
        {quote.updated_at && (
          <DetailRow
            label="Last updated"
            value={<PlatformDateTime value={quote.updated_at} />}
          />
        )}
        {quote.converted_shipment_id && (
          <DetailRow
            label="Shipment"
            value={
              <Link
                href={`${platformPath("freight/tracking")}?shipment=${encodeURIComponent(quote.converted_shipment_id)}`}
                className="inline-flex items-center gap-1 text-[var(--platform-accent)] hover:underline"
              >
                View shipment
                <ExternalLink className="size-3" />
              </Link>
            }
          />
        )}
      </DetailSection>

      {quote.message && (
        <div className="rounded-lg border border-[var(--platform-border)] bg-white/60 p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Customer message
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm">{quote.message}</p>
        </div>
      )}
    </div>
  );
}
