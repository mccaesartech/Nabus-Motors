import Link from "next/link";
import { FoldIndex, FoldRule } from "@/components/fold/fold-primitives";
import { GOOGLE_MAPS_URL, SITE_PHONE_DISPLAY, WHATSAPP_NUMBER, whatsappUrl } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";

export function FoldPlace() {
  return (
    <section className="bg-[var(--nabus-paper)] py-20 sm:py-28">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 lg:px-8 xl:px-10">
        <div>
          <FoldIndex n="09" />
          <h2 className="font-display mt-4 text-[clamp(2.2rem,5vw,4rem)] leading-[1.05] text-[var(--nabus-graphite)]">
            Dzorwulu,
            <br />
            Accra.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--nabus-muted)]">
            A real dealership floor. Come see the car, not a listing.
          </p>
          <FoldRule className="mt-8" />
        </div>

        <dl className="mt-12 space-y-6 lg:mt-10">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b border-[var(--nabus-border)] pb-4">
            <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--nabus-muted)]">Hours</dt>
            <dd className="text-[var(--nabus-graphite)]">Mon to Sat, 09:00 to 18:00</dd>
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b border-[var(--nabus-border)] pb-4">
            <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--nabus-muted)]">Phone</dt>
            <dd>
              <a href={`tel:${SITE_PHONE_DISPLAY.replace(/\s/g, "")}`} className="font-mono text-[13px] text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]">
                {SITE_PHONE_DISPLAY}
              </a>
            </dd>
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b border-[var(--nabus-border)] pb-4">
            <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--nabus-muted)]">WhatsApp</dt>
            <dd>
              <a
                href={whatsappUrl("Hello Nabus, I would like to visit the Dzorwulu showroom.", WHATSAPP_NUMBER)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--nabus-graphite)] underline decoration-[var(--nabus-border)] underline-offset-4 hover:text-[var(--nabus-wine)]"
              >
                Message the floor
              </a>
            </dd>
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4">
            <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--nabus-muted)]">Map</dt>
            <dd className="flex flex-col gap-3">
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--nabus-graphite)] underline decoration-[var(--nabus-border)] underline-offset-4 hover:text-[var(--nabus-wine)]"
              >
                Directions
              </a>
              <Link
                href={ROUTES.corporate.contact}
                className="text-[var(--nabus-wine)] underline decoration-[var(--nabus-wine)]/30 underline-offset-4"
              >
                Book a visit
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
