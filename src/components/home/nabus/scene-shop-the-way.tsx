import Link from "next/link";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { ROUTES } from "@/lib/routes";

const CATEGORIES = [
  {
    id: "city",
    title: "City",
    desc: "Compact, efficient, easy to park.",
    href: `${ROUTES.auto.inventory}?bodyType=Sedan&bodyType=Hatchback`,
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
  },
  {
    id: "family",
    title: "Family",
    desc: "Space, safety, and comfort.",
    href: `${ROUTES.auto.inventory}?bodyType=SUV`,
    image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
  },
  {
    id: "executive",
    title: "Executive",
    desc: "Refined sedans and luxury.",
    href: `${ROUTES.auto.inventory}?bodyType=Luxury`,
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
  },
  {
    id: "rugged",
    title: "Rugged",
    desc: "Trucks built for the road ahead.",
    href: `${ROUTES.auto.inventory}?bodyType=Truck`,
    image: "https://images.unsplash.com/photo-1590362891991-f776e747e588?w=800&q=80",
  },
  {
    id: "value",
    title: "Value",
    desc: "Smart buys under $25k.",
    href: `${ROUTES.auto.inventory}?priceMax=25000`,
    image: "https://images.unsplash.com/photo-1621007947382-bcb3e783bb0e?w=800&q=80",
  },
  {
    id: "premium",
    title: "Premium",
    desc: "Flagship models, fully verified.",
    href: `${ROUTES.auto.inventory}?trust=verified_by_true_goshen`,
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
  },
] as const;

export function SceneShopTheWay() {
  return (
    <section id="collections" className="bg-[var(--nabus-ivory)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <NabusSectionLabel>Shop The Way You Drive</NabusSectionLabel>
        <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
          Collections curated for how you live.
        </h2>

        <div className="mt-10 grid gap-px bg-[var(--nabus-border)] sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden bg-[var(--nabus-warm-graphite)] p-6 sm:min-h-[260px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--nabus-graphite)]/90 via-[var(--nabus-graphite)]/30 to-transparent" />
              <div className="relative">
                <h3 className="text-xl font-semibold text-white">{cat.title}</h3>
                <p className="mt-1 text-sm text-white/70">{cat.desc}</p>
                <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-wide text-[var(--nabus-gold)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Explore →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
