import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo, type LogoBrand } from "@/components/shared/logo";
import { FullPageLink } from "@/components/shared/full-page-link";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { GOOGLE_MAPS_URL, SITE_EMAIL, SITE_PHONE_DISPLAY } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";
import { NABUS_PRIMARY_NAV, flattenNavItems } from "@/lib/nabus/nav";
import { isValidExternalHref } from "@/components/layout/footer-links";
import { NabusArc } from "./nabus-arc";
import { cn } from "@/lib/utils";
import type { SiteContent } from "@/lib/site-content/defaults";

type NabusFooterProps = {
  content: SiteContent;
  brand?: LogoBrand;
};

const footerLink =
  "text-sm text-white/70 transition-colors duration-200 hover:text-[var(--nabus-gold)]";

export function NabusFooter({ content, brand = "auto" }: NabusFooterProps) {
  const { footer, global } = content;
  const navFlat = flattenNavItems(NABUS_PRIMARY_NAV);
  const socials = [
    { label: "Facebook", href: footer.socialFacebook },
    { label: "Instagram", href: footer.socialInstagram },
    { label: "LinkedIn", href: footer.socialLinkedIn },
  ].filter((s) => isValidExternalHref(s.href));

  return (
    <footer className="relative z-10 bg-[var(--nabus-warm-graphite)] text-white">
      <div className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6 lg:px-10 xl:px-12">
        <div className="mb-10">
          <NabusArc width={120} variant="gold" className="opacity-80" />
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--nabus-gold)]">
            {footer.tagline ||
              "Curated drives. Transparent deals. A showroom built for Accra."}
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <FullPageLink href={ROUTES.auto.home} className="inline-block">
              <Logo variant="white" brand={brand} height={40} alt={global.siteName} />
            </FullPageLink>
            <div className="mt-6 space-y-3">
              <a href={`tel:${footer.phoneTel}`} className={cn("flex items-center gap-2", footerLink)}>
                <Phone className="size-4 shrink-0 text-[var(--nabus-gold)]" />
                {SITE_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${SITE_EMAIL}`} className={cn("flex items-center gap-2", footerLink)}>
                <Mail className="size-4 shrink-0 text-[var(--nabus-gold)]" />
                {SITE_EMAIL}
              </a>
              <a
                href={isValidExternalHref(footer.mapsUrl) ? footer.mapsUrl : GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("flex items-start gap-2", footerLink)}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--nabus-gold)]" />
                <span>{footer.addressLine1 || "Dzorwulu, Accra, Ghana"}</span>
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-4">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--nabus-gold)]">
                Showroom
              </h3>
              <ul className="mt-4 space-y-2.5">
                {navFlat.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--nabus-gold)]">
                Legal
              </h3>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link href="/privacy" className={footerLink}>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className={footerLink}>
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.corporate.contact} className={footerLink}>
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--nabus-gold)]">
              New arrivals
            </h3>
            <p className="mt-4 text-sm text-white/60">
              {footer.newsletterDescription || "First look at vehicles as they land."}
            </p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
            {socials.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-4">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium uppercase tracking-wide text-white/50 hover:text-[var(--nabus-gold)]"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Nabus Motors and Trading</p>
          <p className="text-[var(--nabus-gold)]/80">Drive with confidence.</p>
        </div>
      </div>
    </footer>
  );
}
