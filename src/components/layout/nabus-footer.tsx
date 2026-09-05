import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo, type LogoBrand } from "@/components/shared/logo";
import { FullPageLink } from "@/components/shared/full-page-link";
import { Container } from "@/components/shared/container";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { InstallCustomerAppButton } from "@/components/pwa/install-customer-app-button";
import { GOOGLE_MAPS_URL, SITE_EMAIL, SITE_PHONE_DISPLAY } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";
import { NABUS_PRIMARY_NAV, flattenNavItems } from "@/lib/nabus/nav";
import { isValidExternalHref } from "@/components/layout/footer-links";
import { cn } from "@/lib/utils";
import type { SiteContent } from "@/lib/site-content/defaults";

type NabusFooterProps = {
  content: SiteContent;
  brand?: LogoBrand;
};

const footerLink =
  "text-sm text-white/75 transition-colors duration-200 hover:text-[var(--nabus-yellow)]";

export function NabusFooter({ content, brand = "auto" }: NabusFooterProps) {
  const { footer, global } = content;
  const navFlat = flattenNavItems(NABUS_PRIMARY_NAV);
  const socials = [
    { label: "Facebook", href: footer.socialFacebook },
    { label: "Instagram", href: footer.socialInstagram },
    { label: "LinkedIn", href: footer.socialLinkedIn },
  ].filter((s) => isValidExternalHref(s.href));

  return (
    <footer className="relative z-10 border-t border-white/10 bg-[var(--nabus-nav-dark)] text-white">
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <FullPageLink href={ROUTES.corporate.home} className="inline-block">
              <Logo variant="white" brand={brand} height={44} alt={global.siteName} />
            </FullPageLink>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              {footer.tagline ||
                "Your trusted partner for vehicle imports, verified inventory, financing, and complete automotive services in Ghana."}
            </p>
            <div className="mt-6 space-y-3">
              <a href={`tel:${footer.phoneTel}`} className={cn("flex items-center gap-2", footerLink)}>
                <Phone className="size-4 shrink-0 text-[var(--nabus-yellow)]" />
                {SITE_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${SITE_EMAIL}`} className={cn("flex items-center gap-2", footerLink)}>
                <Mail className="size-4 shrink-0 text-[var(--nabus-yellow)]" />
                {SITE_EMAIL}
              </a>
              <a
                href={isValidExternalHref(footer.mapsUrl) ? footer.mapsUrl : GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("flex items-start gap-2", footerLink)}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--nabus-yellow)]" />
                <span>{footer.addressLine1 || "Accra, Ghana"}</span>
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--nabus-yellow)]">
                Explore
              </h3>
              <ul className="mt-4 space-y-2.5">
                {navFlat.slice(0, 7).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--nabus-yellow)]">
                More
              </h3>
              <ul className="mt-4 space-y-2.5">
                {navFlat.slice(7).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/privacy" className={footerLink}>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className={footerLink}>
                    Terms & Conditions
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--nabus-yellow)]">
              Stay Updated
            </h3>
            <p className="mt-4 text-sm text-white/70">
              {footer.newsletterDescription || "New inventory alerts and exclusive offers."}
            </p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <InstallCustomerAppButton display="compact" />
            </div>
            {socials.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold uppercase tracking-wide text-white/60 transition-colors hover:text-[var(--nabus-yellow)]"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Nabus Motors and Trading. All rights reserved.</p>
          <p>Best Automobile Dealer of the Year — Accra, Ghana</p>
        </div>
      </Container>
    </footer>
  );
}
