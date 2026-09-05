import Link from "next/link";
import { Logo, type LogoBrand } from "@/components/shared/logo";
import { FullPageLink } from "@/components/shared/full-page-link";
import { GOOGLE_MAPS_URL, SITE_EMAIL, SITE_PHONE_DISPLAY } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";
import { NABUS_PRIMARY_NAV, flattenNavItems } from "@/lib/nabus/nav";
import { isValidExternalHref } from "@/components/layout/footer-links";
import { FoldCrease } from "@/components/fold/fold-primitives";
import type { SiteContent } from "@/lib/site-content/defaults";

type FoldFooterProps = {
  content: SiteContent;
  brand?: LogoBrand;
};

export function FoldFooter({ content, brand = "auto" }: FoldFooterProps) {
  const { footer, global } = content;
  const navFlat = flattenNavItems(NABUS_PRIMARY_NAV);
  const socials = [
    { label: "Facebook", href: footer.socialFacebook },
    { label: "Instagram", href: footer.socialInstagram },
    { label: "LinkedIn", href: footer.socialLinkedIn },
  ].filter((s) => isValidExternalHref(s.href));

  return (
    <footer className="relative z-10 overflow-hidden bg-[var(--nabus-graphite)] text-[var(--nabus-paper)]">
      <FoldCrease className="top-10 left-[8%] opacity-70" />
      <div className="mx-auto max-w-[92rem] px-4 py-14 sm:px-6 lg:px-8 xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
          <div>
            <FullPageLink href={ROUTES.auto.home} className="inline-block">
              <Logo variant="white" brand={brand} height={36} alt={global.siteName} />
            </FullPageLink>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/55">
              Dzorwulu showroom. Accra. Cars chosen in person.
            </p>
            <div className="mt-6 space-y-2 font-mono text-[12px] text-white/70">
              <a href={`tel:${footer.phoneTel}`} className="block hover:text-[var(--nabus-gold)]">
                {SITE_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${SITE_EMAIL}`} className="block hover:text-[var(--nabus-gold)]">
                {SITE_EMAIL}
              </a>
              <a
                href={isValidExternalHref(footer.mapsUrl) ? footer.mapsUrl : GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-[var(--nabus-gold)]"
              >
                {footer.addressLine1 || "Dzorwulu, Accra"}
              </a>
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-white/40">NB / LINKS</p>
            <ul className="mt-4 space-y-2.5">
              {navFlat.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/70 hover:text-[var(--nabus-gold)]">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/privacy" className="text-sm text-white/70 hover:text-[var(--nabus-gold)]">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-white/70 hover:text-[var(--nabus-gold)]">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-white/40">NB / FLOOR</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/70">
              <li>Mon to Sat</li>
              <li className="font-mono text-[12px]">09:00 to 18:00</li>
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--nabus-gold)]"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-[11px] text-white/35">
            &copy; {new Date().getFullYear()} Nabus Motors and Trading
          </p>
          <p className="text-[11px] tracking-[0.16em] text-[var(--nabus-gold)]">
            Dream It. Drive It. Live It.
          </p>
        </div>
      </div>
    </footer>
  );
}
