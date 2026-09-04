import { notFound } from "next/navigation";
import { PartDetailClient } from "@/components/parts/part-detail-client";
import { loadPublishedPartBySlug } from "@/lib/data/parts";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const part = await loadPublishedPartBySlug(slug);
  if (!part) return { title: "Part not found" };
  return {
    title: part.name,
    description: part.description ?? `Request ${part.name} from Nabus Motors Parts.`,
  };
}

export default async function SparePartDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const part = await loadPublishedPartBySlug(slug);
  if (!part) notFound();

  return <PartDetailClient part={part} />;
}
