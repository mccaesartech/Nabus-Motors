"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Mail, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { NabusEditorialPageHero } from "@/components/nabus/nabus-editorial-page-hero";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import type { ContactSiteContent, FooterSiteContent } from "@/lib/site-content/defaults";

type ContactPageClientProps = {
  contact: ContactSiteContent;
  footer: FooterSiteContent;
};

export function ContactPageClient({ contact, footer }: ContactPageClientProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const res = await fetch("/api/inquiries/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: (form.querySelector("#name") as HTMLInputElement).value,
        email: (form.querySelector("#contact-email") as HTMLInputElement).value,
        phone: (form.querySelector("#contact-phone") as HTMLInputElement).value,
        subject,
        message: (form.querySelector("#message") as HTMLTextAreaElement).value,
      }),
    });
    if (res.ok) setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="bg-[var(--nabus-ivory)]">
      <NabusEditorialPageHero
        label="Contact"
        title={contact.heroTitle}
        description={contact.heroSubtitle}
      />

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="space-y-8 lg:col-span-4">
              <div>
                <NabusSectionLabel>Visit & Reach</NabusSectionLabel>
                <div className="mt-6 space-y-5">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--nabus-wine)]" />
                    <div className="text-sm">
                      <p className="font-medium text-[var(--nabus-graphite)]">{footer.addressLine1}</p>
                      <p className="text-[var(--nabus-muted)]">{footer.addressLine2}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-[var(--nabus-wine)]" />
                    <div className="text-sm">
                      <a
                        href={`tel:${footer.phoneTel}`}
                        className="font-medium text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]"
                      >
                        {footer.phone}
                      </a>
                      <p className="text-[var(--nabus-muted)]">Sales & Support</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-[var(--nabus-wine)]" />
                    <div className="text-sm">
                      <a
                        href={`mailto:${footer.email}`}
                        className="font-medium text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]"
                      >
                        {footer.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Clock className="mt-0.5 size-4 shrink-0 text-[var(--nabus-wine)]" />
                    <div className="text-sm">
                      <p className="font-medium text-[var(--nabus-graphite)]">Business Hours</p>
                      <p className="text-[var(--nabus-muted)]">{contact.hoursWeekday}</p>
                      <p className="text-[var(--nabus-muted)]">{contact.hoursSaturday}</p>
                      <p className="text-[var(--nabus-muted)]">{contact.hoursSunday}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="aspect-video overflow-hidden border border-[var(--nabus-border)] bg-[var(--nabus-paper)]">
                <iframe
                  title="Nabus Motors Location"
                  src="https://maps.google.com/maps?q=Accra,+Ghana&t=&z=12&ie=UTF8&iwloc=&output=embed"
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            <div className="lg:col-span-8">
              {submitted ? (
                <div className="border border-[var(--nabus-border)] bg-[var(--nabus-paper)] p-8 text-center sm:p-12">
                  <CheckCircle2 className="mx-auto size-10 text-[var(--nabus-wine)]" />
                  <h3 className="mt-4 text-lg font-semibold text-[var(--nabus-graphite)]">
                    Message Sent
                  </h3>
                  <p className="mt-2 text-sm text-[var(--nabus-muted)]">
                    Thank you for contacting us. We will respond within one business day.
                  </p>
                </div>
              ) : (
                <form
                  className="space-y-5 border border-[var(--nabus-border)] bg-[var(--nabus-paper)] p-6 sm:p-8"
                  onSubmit={handleSubmit}
                >
                  <NabusSectionLabel>Send a Message</NabusSectionLabel>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" required className="rounded-lg border-[var(--nabus-input-border)]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        required
                        className="rounded-lg border-[var(--nabus-input-border)]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-phone">Phone</Label>
                      <Input id="contact-phone" type="tel" className="rounded-lg border-[var(--nabus-input-border)]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">Subject</Label>
                      <Select value={subject} onValueChange={(v) => setSubject(v ?? "")}>
                        <SelectTrigger id="subject" className="rounded-lg border-[var(--nabus-input-border)]">
                          <SelectValue placeholder="Select topic" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Vehicle Inquiry",
                            "Schedule Inspection",
                            "Financing Question",
                            "Sell My Vehicle",
                            "General Question",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" rows={5} required className="rounded-lg border-[var(--nabus-input-border)]" />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="rounded-lg bg-[var(--nabus-wine)] hover:bg-[var(--nabus-crimson)]"
                  >
                    {loading ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
