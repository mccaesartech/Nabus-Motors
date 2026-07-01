"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useHashScroll } from "@/hooks/use-hash-scroll";
import { Package, Search } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { BackNav } from "@/components/shared/back-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VehiclePrice } from "@/components/shared/vehicle-price";
import { AddToCartButton } from "@/components/parts/add-to-cart-button";
import { ServiceImageCardGrid } from "@/components/shared/service-image-card";
import { ROUTES } from "@/lib/routes";
import type { PartCategory, PublishedPart } from "@/lib/data/parts";

import type { SparePartsLandingSiteContent } from "@/lib/site-content/corporate-defaults";

type SparePartsCatalogProps = {
  parts: PublishedPart[];
  categories: PartCategory[];
  initialQ: string;
  initialCategory: string;
  initialBrand: string;
  initialMake: string;
  landing: SparePartsLandingSiteContent;
};

export function SparePartsCatalog({
  parts,
  categories,
  initialQ,
  initialCategory,
  initialBrand,
  initialMake,
  landing,
}: SparePartsCatalogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [brand, setBrand] = useState(initialBrand);
  const [make, setMake] = useState(initialMake);

  useEffect(() => {
    setQ(initialQ);
    setCategory(initialCategory);
    setBrand(initialBrand);
    setMake(initialMake);
  }, [initialQ, initialCategory, initialBrand, initialMake]);

  useHashScroll(initialCategory, initialQ, initialBrand, initialMake, parts.length);

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    if (category) params.set("category", category);
    else params.delete("category");
    if (brand.trim()) params.set("brand", brand.trim());
    else params.delete("brand");
    if (make.trim()) params.set("make", make.trim());
    else params.delete("make");
    router.push(`${ROUTES.auto.spareParts}?${params.toString()}`);
  }

  function clearFilters() {
    setQ("");
    setCategory("");
    setBrand("");
    setMake("");
    router.push(ROUTES.auto.spareParts);
  }

  return (
    <Container className="py-12 sm:py-16">
      <BackNav href={ROUTES.auto.home} label="Back to Auto Division" variant="public" />

      <div className="mx-auto max-w-6xl">
        <SectionHeader
          title={landing.title}
          description={landing.subtitle}
          className="mt-6"
        />

        {landing.cards.length > 0 && (
          <ServiceImageCardGrid
            className="mt-8"
            cards={landing.cards.map((card) => ({
              id: card.id,
              title: card.title,
              subtitle: card.description,
              image: card.image,
              imageAlt: card.imageAlt,
              href: card.href
                ? card.href.includes("#")
                  ? card.href
                  : `${card.href}#parts-results`
                : undefined,
            }))}
          />
        )}

        <div className="mb-8 mt-10 rounded-xl border border-border bg-card p-4 shadow-luxury sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="parts-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="parts-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Name, SKU, brand…"
                  className="pl-9"
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parts-category">Category</Label>
              <select
                id="parts-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parts-brand">Brand</Label>
              <Input
                id="parts-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Toyota"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parts-make">Compatible make</Label>
              <Input
                id="parts-make"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Honda"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={applyFilters}>
              Apply filters
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>

        <div
          id="parts-results"
          className="scroll-mt-[var(--header-height)]"
        >
        {parts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center">
            <Package className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">No published parts match your filters</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your search or{" "}
              <Link href={ROUTES.corporate.contact} className="text-brand-purple hover:underline">
                contact us
              </Link>{" "}
              for a custom parts request.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {parts.map((part) => (
              <article
                key={part.id}
                className="flex flex-col rounded-xl border border-border/70 bg-card p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg"
              >
                <div className="flex size-12 items-center justify-center rounded-lg border border-icon-box-border bg-icon-box-bg">
                  <Package className="size-6 text-icon-box-fg" />
                </div>
                {part.is_featured && (
                  <span className="mt-3 w-fit rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-purple">
                    Featured
                  </span>
                )}
                <h3 className="mt-2 text-[15px] font-semibold">{part.name}</h3>
                {part.brand && (
                  <p className="mt-1 text-xs text-muted-foreground">{part.brand}</p>
                )}
                {part.parts_categories && (
                  <p className="mt-1 text-xs text-brand-cta-gold">{part.parts_categories.name}</p>
                )}
                {part.price_usd != null && (
                  <p className="mt-2 text-sm font-medium">
                    <VehiclePrice usdAmount={part.price_usd} />
                  </p>
                )}
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {part.description ?? "Genuine spare part — request for availability and pricing."}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {part.price_usd != null && (
                    <AddToCartButton
                      partId={part.id}
                      priceUsd={part.price_usd}
                      slug={part.slug}
                      name={part.name}
                      sku={part.sku}
                      image={part.images[0] ?? null}
                      stockQuantity={part.stock_quantity}
                      className="w-full"
                      variant="default"
                    />
                  )}
                  <Button
                    className="w-full"
                    size="sm"
                    variant={part.price_usd != null ? "outline" : "default"}
                    render={<Link href={ROUTES.auto.sparePartDetail(part.slug)} />}
                  >
                    View &amp; request
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
      </div>
    </Container>
  );
}
