"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { NabusCarTile } from "@/components/nabus/nabus-car-tile";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

type SceneJustLandedProps = {
  vehicles: Vehicle[];
};

export function SceneJustLanded({ vehicles }: SceneJustLandedProps) {
  const railRef = useRef<HTMLDivElement>(null);
  if (vehicles.length === 0) return null;

  function scroll(dir: "left" | "right") {
    railRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  return (
    <section className="border-y border-[var(--nabus-border)] bg-[var(--nabus-paper)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <NabusSectionLabel>Just Landed</NabusSectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
              Fresh arrivals on the floor.
            </h2>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="inline-flex size-10 items-center justify-center border border-[var(--nabus-border)] text-[var(--nabus-graphite)] hover:border-[var(--nabus-wine)]"
              aria-label="Scroll left"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="inline-flex size-10 items-center justify-center border border-[var(--nabus-border)] text-[var(--nabus-graphite)] hover:border-[var(--nabus-wine)]"
              aria-label="Scroll right"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div
          ref={railRef}
          className="mt-10 flex gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="w-[min(85vw,280px)] shrink-0 sm:w-[300px]">
              <NabusCarTile vehicle={vehicle} layout="rail" />
            </div>
          ))}
        </div>

        <Link
          href={`${ROUTES.auto.inventory}?sort=newest`}
          className="mt-8 inline-block text-sm font-semibold uppercase tracking-wide text-[var(--nabus-wine)]"
        >
          See new arrivals →
        </Link>
      </div>
    </section>
  );
}
