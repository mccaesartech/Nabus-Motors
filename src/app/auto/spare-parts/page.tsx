import { Suspense } from "react";
import { SparePartsCatalog } from "@/components/parts/spare-parts-catalog";
import { loadPartCategories, loadPublishedParts } from "@/lib/data/parts";
import { getSiteContent } from "@/lib/site-content";

export const metadata = {
  title: "Genuine Spare Parts",
  description:
    "Browse and request genuine OEM and aftermarket auto parts from True Goshen Auto Parts.",
};

export const revalidate = 60;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    make?: string;
  }>;
};

export default async function SparePartsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [parts, categories, content] = await Promise.all([
    loadPublishedParts({
      q: params.q,
      category: params.category,
      brand: params.brand,
      make: params.make,
    }),
    loadPartCategories(),
    getSiteContent(),
  ]);

  return (
    <Suspense>
      <SparePartsCatalog
        parts={parts}
        categories={categories}
        initialQ={params.q ?? ""}
        initialCategory={params.category ?? ""}
        initialBrand={params.brand ?? ""}
        initialMake={params.make ?? ""}
        landing={content.sparePartsLanding}
      />
    </Suspense>
  );
}
