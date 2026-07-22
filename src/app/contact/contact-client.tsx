"use client";

import { useState } from "react";
import { Container } from "@/components/shared/container";
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
    <>
      <section className="bg-brand-primary py-16 sm:py-20">
        <Container>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{contact.heroTitle}</h1>
          <p className="mt-4 max-w-lg text-base text-on-dark-secondary">{contact.heroSubtitle}</p>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Get in Touch</h2>
                <div className="mt-5 space-y-4">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">{footer.addressLine1}</p>
                      <p className="text-muted-foreground">{footer.addressLine2}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="text-sm">
                      <a
                        href={`tel:${footer.phoneTel}`}
                        className="font-medium hover:text-foreground"
                      >
                        {footer.phone}
                      </a>
                      <p className="text-muted-foreground">Sales & Support</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="text-sm">
                      <a
                        href={`mailto:${footer.email}`}
                        className="font-medium hover:text-foreground"
                      >
                        {footer.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">Business Hours</p>
                      <p className="text-muted-foreground">{contact.hoursWeekday}</p>
                      <p className="text-muted-foreground">{contact.hoursSaturday}</p>
                      <p className="text-muted-foreground">{contact.hoursSunday}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="aspect-video overflow-hidden border border-border bg-muted">
                <iframe
                  title="True Goshen Auto Location"
                  src="https://maps.google.com/maps?q=Accra,+Ghana&t=&z=12&ie=UTF8&iwloc=&output=embed"
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              {submitted ? (
                <div className="border border-border p-8 text-center">
                  <CheckCircle2 className="mx-auto size-10 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Message Sent</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Thank you for contacting us. We will respond within one business day.
                  </p>
                </div>
              ) : (
                <form
                  className="space-y-5 border border-border p-6 sm:p-8"
                  onSubmit={handleSubmit}
                >
                  <h2 className="text-lg font-semibold">Send a Message</h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email">Email</Label>
                      <Input id="contact-email" type="email" required />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-phone">Phone</Label>
                      <Input id="contact-phone" type="tel" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">Subject</Label>
                      <Select value={subject} onValueChange={(v) => setSubject(v ?? "")}>
                        <SelectTrigger id="subject">
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
                    <Textarea id="message" rows={5} required />
                  </div>
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
