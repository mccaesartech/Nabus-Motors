import Link from "next/link";
import { MapPin, Clock, Phone } from "lucide-react";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { GOOGLE_MAPS_URL, SITE_PHONE_DISPLAY } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";

export function SceneShowroomLocation() {
  return (
    <section className="bg-[var(--nabus-ivory)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <NabusSectionLabel>The Showroom</NabusSectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
              Dzorwulu, Accra.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--nabus-muted)]">
              Visit our showroom to inspect vehicles, discuss import options, and meet our team.
              Real cars. Real people. No pressure.
            </p>
            <ul className="mt-8 space-y-4 text-sm text-[var(--nabus-graphite)]">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--nabus-gold)]" />
                <span>Dzorwulu, Accra, Ghana</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-[var(--nabus-gold)]" />
                <span>Mon – Sat · 9:00 – 18:00</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-[var(--nabus-gold)]" />
                <a href={`tel:${SITE_PHONE_DISPLAY.replace(/\s/g, "")}`} className="hover:text-[var(--nabus-wine)]">
                  {SITE_PHONE_DISPLAY}
                </a>
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={ROUTES.corporate.contact}
                className="inline-flex h-11 items-center bg-[var(--nabus-wine)] px-6 text-sm font-semibold uppercase tracking-wide text-white hover:bg-[var(--nabus-crimson)]"
              >
                Book a Visit
              </Link>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center border border-[var(--nabus-border)] px-6 text-sm font-semibold uppercase tracking-wide text-[var(--nabus-graphite)] hover:border-[var(--nabus-wine)]"
              >
                Get Directions
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden border border-[var(--nabus-border)] bg-[var(--nabus-warm-graphite)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=1200&q=80"
              alt="Nabus Motors showroom"
              className="h-full w-full object-cover opacity-90"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
