"use client";

import { CalendarCheck, CalendarClock, MapPin } from "lucide-react";
import { BookAppointmentPanel } from "@/components/checkout/book-appointment-panel";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import type { CustomerAppointmentSummary } from "@/lib/account/types";
import { appointmentStatusLabel } from "@/lib/account/types";
import type { CheckoutCompleteContext } from "@/lib/checkout/complete-context";
import { cn } from "@/lib/utils";

type BookVisitSectionProps = {
  context: CheckoutCompleteContext;
  appointments: CustomerAppointmentSummary[];
  loading: boolean;
  onBooked?: () => void;
};

export function BookVisitSection({
  context,
  appointments,
  loading,
  onBooked,
}: BookVisitSectionProps) {
  const upcoming = appointments.filter(
    (appt) => appt.status === "pending" || appt.status === "confirmed"
  );

  return (
    <section id="book-visit" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4">
      <AccountSectionHeader
        icon={<CalendarCheck className="size-5" />}
        title="Book a Showroom Visit"
        description="Schedule a visit to see your vehicles in person and complete payment with our team."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading appointments…</p>
      ) : upcoming.length > 0 ? (
        <ul id="appointments" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-3">
          {upcoming.map((appt) => (
            <li
              key={appt.id}
              className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-purple/15 text-brand-purple">
                    <CalendarClock className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {appt.preferred_date
                        ? new Date(appt.preferred_date).toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })
                        : "Date to be confirmed"}
                      {appt.preferred_time ? ` · ${appt.preferred_time}` : ""}
                    </p>
                    {appt.branch && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        {appt.branch}
                      </p>
                    )}
                    {appt.vehicle_names.length > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Vehicles: {appt.vehicle_names.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
                    appt.status === "confirmed"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  {appointmentStatusLabel(appt.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <BookAppointmentPanel
        context={context}
        onBooked={onBooked}
        showSkip={upcoming.length === 0}
      />
    </section>
  );
}
