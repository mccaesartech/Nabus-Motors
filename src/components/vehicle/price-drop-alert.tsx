"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { formatVehicleName } from "@/lib/format";

interface PriceDropAlertProps {
  vehicle: Vehicle;
}

export function PriceDropAlert({ vehicle }: PriceDropAlertProps) {
  const { user, profile } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (profile?.phone) setPhone(profile.phone);
  }, [user?.email, profile?.phone]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/inquiries/price-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim() || null,
          vehicleId: vehicle.id,
          vehicleSlug: vehicle.slug,
          vehicleName: formatVehicleName(vehicle),
          priceUsd: vehicle.price,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setToast(data?.error ?? "Could not save alert. Please try again.");
        return;
      }

      setToast("We'll notify you if the price drops.");
    } catch {
      setToast("Could not save alert. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md border border-brand-purple/30 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-luxury"
        >
          {toast}
        </div>
      )}

      <Accordion className="border border-border bg-muted/30">
        <AccordionItem value="price-alert" className="border-0">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <Bell className="size-4 shrink-0 text-brand-purple" />
              <div>
                <span className="text-sm font-semibold">Notify me if price drops</span>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  Get an email when this vehicle&apos;s price changes
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="price-alert-email">Email</Label>
                <Input
                  id="price-alert-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-alert-phone">Phone (optional)</Label>
                <Input
                  id="price-alert-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233…"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving…" : "Set price alert"}
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
