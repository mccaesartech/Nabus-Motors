"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { BackNav } from "@/components/shared/back-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VehiclePrice } from "@/components/shared/vehicle-price";
import { AddToCartButton } from "@/components/parts/add-to-cart-button";
import { usePartsCart } from "@/context/parts-cart-context";
import { ROUTES } from "@/lib/routes";
import type { PublishedPart } from "@/lib/data/parts";
import { Package } from "lucide-react";

type PartDetailClientProps = {
  part: PublishedPart;
};

export function PartDetailClient({ part }: PartDetailClientProps) {
  const { getQuantity } = usePartsCart();
  const cartQty = getQuantity(part.id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/inquiries/parts-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          partId: part.id,
          partName: part.name,
          partSlug: part.slug,
          sku: part.sku,
          quantity: Number(quantity) || 1,
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          text: json.message ?? "Could not submit request. Please try again.",
        });
        return;
      }
      setFeedback({
        ok: true,
        text: "Request submitted — our parts team will contact you with availability and pricing.",
      });
      setName("");
      setEmail("");
      setPhone("");
      setQuantity("1");
      setMessage("");
    } catch {
      setFeedback({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const inStock = part.stock_quantity > 0;

  return (
    <Container className="py-12 sm:py-16">
      <BackNav href={ROUTES.auto.spareParts} label="Back to spare parts" variant="public" />

      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
        <div>
          <div className="flex size-16 items-center justify-center rounded-xl border border-icon-box-border bg-icon-box-bg">
            <Package className="size-8 text-icon-box-fg" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">{part.name}</h1>
          {part.brand && <p className="mt-2 text-sm text-muted-foreground">Brand: {part.brand}</p>}
          {part.sku && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">SKU: {part.sku}</p>
          )}
          {part.parts_categories && (
            <p className="mt-2 text-sm text-brand-cta-gold">{part.parts_categories.name}</p>
          )}
          {part.price_usd != null && (
            <p className="mt-4 text-xl font-semibold">
              <VehiclePrice usdAmount={part.price_usd} />
            </p>
          )}
          {part.price_usd != null && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AddToCartButton
                partId={part.id}
                priceUsd={part.price_usd}
                slug={part.slug}
                name={part.name}
                sku={part.sku}
                image={part.images[0] ?? null}
                stockQuantity={part.stock_quantity}
                size="default"
                variant="default"
              />
              {cartQty > 0 && (
                <Link
                  href={ROUTES.auto.cart}
                  className="text-sm font-medium text-brand-purple hover:underline"
                >
                  {cartQty} in cart — view cart
                </Link>
              )}
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {inStock ? `${part.stock_quantity} in stock` : "Contact for availability"}
          </p>
          {part.description && (
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{part.description}</p>
          )}
          {(part.compatible_makes.length > 0 || part.compatible_models.length > 0) && (
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              {part.compatible_makes.length > 0 && (
                <p>
                  <strong className="text-foreground">Makes:</strong>{" "}
                  {part.compatible_makes.join(", ")}
                </p>
              )}
              {part.compatible_models.length > 0 && (
                <p>
                  <strong className="text-foreground">Models:</strong>{" "}
                  {part.compatible_models.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-4 rounded-xl border border-border bg-card p-6 shadow-luxury"
        >
          <h2 className="text-lg font-semibold">Request this part</h2>
          <p className="text-sm text-muted-foreground">
            Submit your details and our parts team will confirm availability, pricing, and delivery.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="part-req-name">Full name *</Label>
            <Input
              id="part-req-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-req-email">Email *</Label>
            <Input
              id="part-req-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-req-phone">Phone</Label>
            <Input
              id="part-req-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-req-qty">Quantity</Label>
            <Input
              id="part-req-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-req-message">Notes</Label>
            <Textarea
              id="part-req-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Vehicle details, urgency, etc."
            />
          </div>
          {feedback && (
            <p className={feedback.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
              {feedback.text}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={ROUTES.corporate.contact} />}
          >
            Or contact us directly
          </Button>
        </form>
      </div>
    </Container>
  );
}
