"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { VehicleCard } from "@/components/shared/vehicle-card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";
import {
  hasMeaningfulPreferences,
  readVehiclePreferences,
  subscribeVehiclePreferences,
} from "@/lib/vehicle-preferences";

type RecommendedVehiclesSectionProps = {
  variant?: "homepage" | "inventory";
  excludeIds?: string[];
};

function usePreferenceVersion() {
  return useSyncExternalStore(
    subscribeVehiclePreferences,
    () => readVehiclePreferences().updatedAt,
    () => ""
  );
}

export function RecommendedVehiclesSection({
  variant = "homepage",
  excludeIds,
}: RecommendedVehiclesSectionProps) {
  const version = usePreferenceVersion();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [subtitle, setSubtitle] = useState("");
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const [loading, setLoading] = useState(true);

  const preferences = useMemo(() => readVehiclePreferences(), [version]);

  // Stable identity for the effect below — a default `[]` prop would be a new
  // array every render and re-trigger the fetch in a loop.
  const excludeKey = excludeIds?.join(",") ?? "";
  const stableExcludeIds = useMemo(
    () => (excludeKey ? excludeKey.split(",") : []),
    [excludeKey]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/vehicles/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferences,
            excludeIds: stableExcludeIds,
            limit: variant === "inventory" ? 4 : 6,
          }),
        });
        if (!res.ok) throw new Error("recommendations failed");
        const data = (await res.json()) as {
          vehicles: Vehicle[];
          subtitle: string;
          hasPersonalization: boolean;
        };
        if (cancelled) return;
        setVehicles(data.vehicles ?? []);
        setSubtitle(data.subtitle ?? "");
        setHasPersonalization(Boolean(data.hasPersonalization));
      } catch {
        if (!cancelled) {
          setVehicles([]);
          setSubtitle("");
          setHasPersonalization(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [preferences, stableExcludeIds, variant]);

  // Only hide before the first load; on refetches keep showing stale content
  // so the section doesn't unmount/remount and shift the page layout.
  if (loading) return null;
  if (!hasMeaningfulPreferences(preferences)) return null;
  if (vehicles.length === 0) return null;

  const showPersonalized = hasPersonalization && hasMeaningfulPreferences(preferences);
  const title = showPersonalized ? "Recommended for You" : "You Might Like";
  const description = showPersonalized
    ? subtitle
    : "Popular picks from our current inventory.";

  const content = (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          {showPersonalized && (
            <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
              <Sparkles className="size-4" strokeWidth={2} />
            </div>
          )}
          <SectionHeader
            title={title}
            description={description}
            className="mb-0"
          />
        </div>
        {variant === "homepage" && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden shrink-0 text-brand-purple hover:text-foreground sm:inline-flex"
            render={<Link href={ROUTES.auto.inventory} />}
          >
            View All
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <div
        className={
          variant === "homepage"
            ? "mt-8 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            : "mt-6 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </>
  );

  if (variant === "inventory") {
    return (
      <div className="mb-8 rounded-xl border border-brand-purple/15 bg-brand-purple/5 p-4 sm:p-5">
        {content}
      </div>
    );
  }

  return (
    <section className="border-t border-border bg-muted/15 py-16 sm:py-20">
      <Container>{content}</Container>
    </section>
  );
}
