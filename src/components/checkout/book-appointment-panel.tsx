"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomerDataTrustNote } from "@/components/forms/customer-data-trust-note";
import { useCustomerAuth } from "@/context/customer-auth-context";
import type { CheckoutCompleteContext } from "@/lib/checkout/complete-context";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type BookAppointmentPanelProps = {
  context: CheckoutCompleteContext;
  onBooked?: () => void;
  className?: string;
  showSkip?: boolean;
  id?: string;
};

export function BookAppointmentPanel({
  context,
  onBooked,
  className,
  showSkip = true,
  id = "book-appointment-form",
}: BookAppointmentPanelProps) {
  const { getAccessToken } = useCustomerAuth();
  const [branches, setBranches] = useState<string[]>(["Accra"]);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [branch, setBranch] = useState("");
  const [phone, setPhone] = useState(context.phone);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const list = String(json?.settings?.appointment_branches ?? "")
          .split(/\r?\n|,/)
          .map((item: string) => item.trim())
          .filter(Boolean);
        if (list.length > 0) {
          setBranches(list);
          setBranch((prev) => prev || list[0]);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setPhone(context.phone);
  }, [context.phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/inquiries/appointment", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: context.name,
          email: context.email,
          phone,
          preferredDate,
          preferredTime,
          branch,
          notes,
          vehicleId: context.vehicles[0]?.id,
          vehicleIds: context.vehicles,
          orderId: context.orderId,
          inquiryId: context.inquiryId,
          source: context.source,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          text: json.message ?? "Could not submit appointment. Please try again.",
        });
        return;
      }

      setFeedback({ ok: true, text: json.message ?? "Appointment request received." });
      onBooked?.();
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (skipped) {
    return (
      <div className={cn("rounded-xl border border-border bg-muted/40 p-6 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          You can book a showroom visit anytime from your{" "}
          <Link href={ROUTES.corporate.account} className="text-brand-purple hover:underline">
            account
          </Link>{" "}
          or by contacting our team.
        </p>
      </div>
    );
  }

  const booked = feedback?.ok;

  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border border-brand-purple/25 bg-card p-6 shadow-luxury",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
          {booked ? <CheckCircle2 className="size-5" /> : <CalendarCheck className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {booked ? "Appointment requested" : "Book a showroom visit"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {booked
              ? "Our team will confirm your preferred time and walk you through viewing and payment."
              : "Schedule a visit to see your vehicle(s) in person and complete payment with our team."}
          </p>
        </div>
      </div>

      {context.vehicles.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm">
          {context.vehicles.map((vehicle) => (
            <li key={vehicle.id} className="font-medium text-foreground">
              {vehicle.name}
            </li>
          ))}
        </ul>
      )}

      {!booked ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Preferred date *</Label>
              <Input
                id="appt-date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                required
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Preferred time</Label>
              <Input
                id="appt-time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-branch">Showroom location *</Label>
            <select
              id="appt-branch"
              value={branch || branches[0]}
              onChange={(e) => setBranch(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              {branches.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-phone">Phone *</Label>
            <Input
              id="appt-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">Notes</Label>
            <Textarea
              id="appt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Questions about payment, trade-in, or timing…"
            />
          </div>

          {feedback && !feedback.ok && (
            <p className="text-sm text-destructive">{feedback.text}</p>
          )}

          <CustomerDataTrustNote />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting} size="lg" className="min-h-11">
              {submitting ? "Submitting…" : "Request appointment"}
            </Button>
            {showSkip && (
              <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => setSkipped(true)}>
                Skip for now
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-emerald-700">{feedback.text}</p>
          <p className="text-sm text-muted-foreground">
            You can track your appointment status anytime in your{" "}
            <Link href={`${ROUTES.corporate.account}#appointments`} className="font-medium text-brand-purple hover:underline">
              account
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
