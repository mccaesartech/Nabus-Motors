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
import { CheckCircle2 } from "lucide-react";

export default function SellPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [condition, setCondition] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const res = await fetch("/api/inquiries/appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        make: (form.querySelector("#make") as HTMLInputElement).value,
        model: (form.querySelector("#model") as HTMLInputElement).value,
        year: (form.querySelector("#year") as HTMLInputElement).value,
        mileage: (form.querySelector("#mileage") as HTMLInputElement).value,
        condition,
        sellerName: (form.querySelector("#seller-name") as HTMLInputElement).value,
        sellerPhone: (form.querySelector("#seller-phone") as HTMLInputElement).value,
        notes: (form.querySelector("#seller-notes") as HTMLTextAreaElement).value,
      }),
    });
    if (res.ok) setSubmitted(true);
    setLoading(false);
  }

  return (
    <>
      <section className="bg-brand-black py-16 sm:py-20">
        <Container>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Sell Your Vehicle
          </h1>
          <p className="mt-4 max-w-xl text-base text-text-secondary">
            Receive a fair market appraisal and sell your vehicle through our
            trusted platform or trade toward your next purchase.
          </p>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold">Why Sell With Us</h2>
              <div className="mt-6 space-y-4 text-sm text-muted-foreground">
                <p>
                  True Goshen Auto offers competitive appraisals based on current
                  market data, vehicle condition, and demand. Our process is
                  transparent — you receive a detailed valuation breakdown.
                </p>
                <p>
                  Choose to sell outright, consign your vehicle through our
                  platform, or apply the value as trade-in credit toward your
                  next purchase.
                </p>
              </div>
            </div>

            <div>
              {submitted ? (
                <div className="border border-border p-8 text-center">
                  <CheckCircle2 className="mx-auto size-10 text-brand-gold" />
                  <h3 className="mt-4 text-lg font-semibold">
                    Appraisal Request Received
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We will review your vehicle details and contact you within one
                    business day with an initial valuation.
                  </p>
                </div>
              ) : (
                <form className="space-y-5 border border-border p-6" onSubmit={handleSubmit}>
                  <h2 className="text-lg font-semibold">Request an Appraisal</h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="make">Make</Label>
                      <Input id="make" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="model">Model</Label>
                      <Input id="model" required />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" type="number" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mileage">Mileage</Label>
                      <Input id="mileage" type="number" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="condition">Condition</Label>
                    <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
                      <SelectTrigger id="condition">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Excellent", "Good", "Fair", "Needs Work"].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="seller-name">Your Name</Label>
                      <Input id="seller-name" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="seller-phone">Phone</Label>
                      <Input id="seller-phone" type="tel" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seller-notes">Additional Details</Label>
                    <Textarea id="seller-notes" rows={3} />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={loading}>
                    {loading ? "Submitting…" : "Submit for Appraisal"}
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
