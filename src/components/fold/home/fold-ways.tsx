import Link from "next/link";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const WAYS = [
  {
    id: "city",
    title: "City",
    line: "Tight streets. Easy parking.",
    href: `${ROUTES.auto.inventory}?bodyType=Sedan&bodyType=Hatchback`,
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1600&q=80",
    align: "left",
    height: "min-h-[58vh]",
  },
  {
    id: "family",
    title: "Family",
    line: "Room for the week, and the weekend.",
    href: `${ROUTES.auto.inventory}?bodyType=SUV`,
    image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1600&q=80",
    align: "right",
    height: "min-h-[48vh]",
  },
  {
    id: "executive",
    title: "Executive",
    line: "Quiet cabins. Long days.",
    href: `${ROUTES.auto.inventory}?bodyType=Luxury`,
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1600&q=80",
    align: "left",
    height: "min-h-[64vh]",
  },
  {
    id: "rugged",
    title: "Rugged",
    line: "Built for the road out of town.",
    href: `${ROUTES.auto.inventory}?bodyType=Truck`,
    image: "https://images.unsplash.com/photo-1590362891991-f776e747e588?w=1600&q=80",
    align: "right",
    height: "min-h-[50vh]",
  },
  {
    id: "value",
    title: "Value",
    line: "Smart buys under $25k.",
    href: `${ROUTES.auto.inventory}?priceMax=25000`,
    image: "https://images.unsplash.com/photo-1621007947382-bcb3e783bb0e?w=1600&q=80",
    align: "left",
    height: "min-h-[46vh]",
  },
  {
    id: "premium",
    title: "Premium",
    line: "Flagship cars, checked twice.",
    href: `${ROUTES.auto.inventory}?trust=documentation_verified`,
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1600&q=80",
    align: "right",
    height: "min-h-[58vh]",
  },
] as const;

export function FoldWays() {
  return (
    <section id="collections" className="bg-[var(--nabus-ivory)]">
      <div className="mx-auto max-w-[92rem] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 xl:px-10">
        <FoldIndex n="05" />
        <h2 className="font-display mt-3 max-w-md text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] text-[var(--nabus-graphite)]">
          Ways to drive
        </h2>
      </div>

      <div>
        {WAYS.map((way) => (
          <Link
            key={way.id}
            href={way.href}
            className={cn(
              "group relative flex overflow-hidden bg-[var(--nabus-graphite)]",
              way.height,
              way.align === "right" ? "items-end justify-end" : "items-end justify-start"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={way.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div
              className={cn(
                "absolute inset-0",
                way.align === "right"
                  ? "bg-gradient-to-l from-[var(--nabus-graphite)]/80 via-[var(--nabus-graphite)]/25 to-transparent"
                  : "bg-gradient-to-r from-[var(--nabus-graphite)]/80 via-[var(--nabus-graphite)]/25 to-transparent"
              )}
            />
            <div className="relative max-w-sm px-6 py-10 sm:px-10">
              <h3 className="font-display text-4xl text-[var(--nabus-paper)] sm:text-5xl">{way.title}</h3>
              <p className="mt-2 text-sm text-white/75">{way.line}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
