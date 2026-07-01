"use client";

import Link from "next/link";
import { useState } from "react";
import { useHashScroll } from "@/hooks/use-hash-scroll";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { ServiceImageCardGrid } from "@/components/shared/service-image-card";
import { ShipmentTimeline } from "@/components/shared/shipment-timeline";
import { VisualShipmentTimeline } from "@/components/shared/visual-shipment-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FREIGHT_QUOTE_STATUS_LABELS,
  shipmentStatusLabel,
  type FreightQuoteStatus,
} from "@/lib/platform/shipment";
import { formatCargoDisplay } from "@/lib/freight/cargo-options";
import type { FreightTrackingSiteContent } from "@/lib/site-content/corporate-defaults";
import { Package, MapPin, Ship } from "lucide-react";

type TrackingResult = {
  tracking_number: string;
  status: string;
  origin_country: string | null;
  destination: string | null;
  estimated_arrival: string | null;
  vessel_name: string | null;
  admin_notes: string | null;
  events: Array<{
    title: string;
    description: string | null;
    location: string | null;
    event_at: string;
  }>;
};

type QuoteResult = {
  reference_code: string | null;
  status: string;
  service_type: string;
  origin_country?: string | null;
  destination?: string | null;
  cargo_description?: string | null;
  cargo_size?: string | null;
  created_at?: string;
  message?: string;
};

type FreightTrackingClientProps = {
  pageContent: FreightTrackingSiteContent;
};

type LookupMode = "tracking" | "reference" | "contact";

export function FreightTrackingClient({ pageContent }: FreightTrackingClientProps) {
  useHashScroll();

  const [lookupMode, setLookupMode] = useState<LookupMode>("tracking");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setQuoteResult(null);

    if (lookupMode === "contact") {
      if (!email.trim() || !phone.trim()) {
        setError("Enter both the email and phone number from your quote or order.");
        return;
      }
    } else if (!email.trim() && !phone.trim()) {
      setError("Enter the email or phone number associated with your shipment or quote.");
      return;
    }

    if (lookupMode === "tracking" && !trackingNumber.trim()) {
      setError("Enter your tracking number.");
      return;
    }

    if (lookupMode === "reference" && !referenceCode.trim()) {
      setError("Enter your quote reference number.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (lookupMode === "tracking") {
        params.set("number", trackingNumber.trim());
      } else if (lookupMode === "reference") {
        params.set("reference", referenceCode.trim());
      }
      if (email.trim()) params.set("email", email.trim());
      if (phone.trim()) params.set("phone", phone.trim());

      const res = await fetch(`/api/tracking?${params}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Shipment not found. Check your details and try again.");
        return;
      }

      if (json.type === "quote" && json.quote) {
        setQuoteResult(json.quote as QuoteResult);
        return;
      }

      if (json.shipment) {
        setResult(json.shipment as TrackingResult);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <SectionHeader title={pageContent.title} description={pageContent.subtitle} />

        {pageContent.cards.length > 0 && (
          <div className="mb-10">
            <ServiceImageCardGrid
              cards={pageContent.cards.map((card) => ({
                id: card.id,
                title: card.title,
                subtitle: card.description,
                image: card.image,
                imageAlt: card.imageAlt,
                href: card.href || "#track-form",
              }))}
            />
          </div>
        )}

        <div className="mx-auto max-w-2xl">
          <form
            id="track-form"
            onSubmit={handleTrack}
            className="scroll-mt-[var(--header-height)] space-y-4 rounded-xl border border-border bg-card p-6 shadow-luxury"
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["tracking", "Tracking number"],
                  ["reference", "Quote reference"],
                  ["contact", "Email + phone"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLookupMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    lookupMode === mode
                      ? "bg-brand-purple text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {lookupMode === "tracking" && (
              <div className="space-y-1.5">
                <Label htmlFor="tracking-number">{pageContent.form.trackingNumberLabel}</Label>
                <Input
                  id="tracking-number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder={pageContent.form.trackingNumberPlaceholder}
                  required
                />
              </div>
            )}

            {lookupMode === "reference" && (
              <div className="space-y-1.5">
                <Label htmlFor="reference-code">Quote reference number</Label>
                <Input
                  id="reference-code"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. FQ-2026-ABC123"
                  required
                />
              </div>
            )}

            {lookupMode !== "contact" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tracking-email">{pageContent.form.emailLabel}</Label>
                  <Input
                    id="tracking-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={pageContent.form.emailPlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tracking-phone">{pageContent.form.phoneLabel}</Label>
                  <Input
                    id="tracking-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={pageContent.form.phonePlaceholder}
                  />
                </div>
              </div>
            )}

            {lookupMode === "contact" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tracking-email-contact">{pageContent.form.emailLabel} *</Label>
                  <Input
                    id="tracking-email-contact"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={pageContent.form.emailPlaceholder}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tracking-phone-contact">{pageContent.form.phoneLabel} *</Label>
                  <Input
                    id="tracking-phone-contact"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={pageContent.form.phonePlaceholder}
                    required
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{pageContent.form.helpText}</p>
            <p className="text-xs text-muted-foreground">
              Don&apos;t have a tracking number? Use the reference from your confirmation email
              or{" "}
              <Link href="/login" className="font-medium text-brand-purple hover:underline">
                sign in to your account
              </Link>
              .
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? pageContent.form.loadingLabel : pageContent.form.submitLabel}
            </Button>
          </form>

          {quoteResult && (
            <div className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6 shadow-luxury">
              <VisualShipmentTimeline
                mode="quote"
                status={quoteResult.status}
                referenceId={quoteResult.reference_code}
              />
              <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Quote reference
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold">
                    {quoteResult.reference_code ?? "—"}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                  {FREIGHT_QUOTE_STATUS_LABELS[quoteResult.status as FreightQuoteStatus] ??
                    quoteResult.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {quoteResult.message ??
                  "Your quote is being reviewed. We will contact you when a shipment is booked."}
              </p>
              {formatCargoDisplay(quoteResult.cargo_description, quoteResult.cargo_size) && (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Cargo:</strong>{" "}
                  {formatCargoDisplay(quoteResult.cargo_description, quoteResult.cargo_size)}
                </p>
              )}
              {(quoteResult.origin_country || quoteResult.destination) && (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Route:</strong>{" "}
                  {quoteResult.origin_country ?? "—"} → {quoteResult.destination ?? "Ghana"}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-luxury">
              <VisualShipmentTimeline
                status={result.status}
                trackingId={result.tracking_number}
                expectedArrival={result.estimated_arrival}
              />

              <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tracking number
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold">{result.tracking_number}</p>
                </div>
                <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-sm font-medium text-brand-purple">
                  {shipmentStatusLabel(result.status)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {result.origin_country && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong className="text-foreground">Origin:</strong> {result.origin_country}
                    </span>
                  </div>
                )}
                {result.destination && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Package className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong className="text-foreground">Destination:</strong> {result.destination}
                    </span>
                  </div>
                )}
                {result.vessel_name && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Ship className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong className="text-foreground">Vessel:</strong> {result.vessel_name}
                    </span>
                  </div>
                )}
                {result.estimated_arrival && (
                  <div className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Est. arrival:</strong>{" "}
                    {new Date(result.estimated_arrival).toLocaleDateString()}
                  </div>
                )}
              </div>

              {result.admin_notes && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <strong className="text-foreground">Update from our team:</strong>{" "}
                  {result.admin_notes}
                </div>
              )}

              {result.events.length > 0 && (
                <div className="border-t border-border pt-6">
                  <h3 className="text-sm font-semibold">Event history</h3>
                  <ShipmentTimeline events={result.events} className="mt-4" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
