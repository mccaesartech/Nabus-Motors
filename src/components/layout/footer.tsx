import { Mail, MapPin, Phone } from "lucide-react";
import { Logo, type LogoBrand } from "@/components/shared/logo";
import { FullPageLink } from "@/components/shared/full-page-link";
import { Container } from "@/components/shared/container";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import {
  footerCompanyLinks,
  footerInventoryLinks,
  footerLegalLinks,
  isValidExternalHref,
} from "@/components/layout/footer-links";
import { InstallCustomerAppButton } from "@/components/pwa/install-customer-app-button";
import { GOOGLE_MAPS_URL } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { SiteContent } from "@/lib/site-content/defaults";

const footerLinkClass =
  "inline-flex min-h-11 items-center text-sm text-white/80 transition-colors duration-200 hover:text-brand-cta-gold";

const contactTextClass =
  "text-sm leading-snug text-white/80 transition-colors duration-200 hover:text-white";

function FooterSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 border-b border-white/10 pb-10 last:border-b-0 last:pb-0 sm:border-b-0 sm:pb-0",
        className
      )}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
        {title}
      </h3>
      <div
        className="mt-2.5 h-0.5 w-10 rounded-full bg-brand-cta-gold"
        aria-hidden="true"
      />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ContactIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-white/70">
      {children}
    </span>
  );
}

function resolveMapsUrl(url: string): string {
  return isValidExternalHref(url) ? url.trim() : GOOGLE_MAPS_URL;
}

function resolvePhoneTel(phoneTel: string): string {
  const digits = phoneTel.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

type FooterProps = {
  content: SiteContent;
  showInventory?: boolean;
  brand?: LogoBrand;
};

export function Footer({ content, showInventory = false, brand = "corporate" }: FooterProps) {
  const { footer, global } = content;
  const mapsUrl = resolveMapsUrl(footer.mapsUrl);
  const phoneTel = resolvePhoneTel(footer.phoneTel);
  const socials = [
    { label: "Facebook", href: footer.socialFacebook },
    { label: "Instagram", href: footer.socialInstagram },
    { label: "LinkedIn", href: footer.socialLinkedIn },
  ].filter((social) => isValidExternalHref(social.href));

  return (
    <footer className="relative z-10 border-t border-white/10 bg-brand-primary text-white">
      <Container className="py-12 lg:py-14">
        <div
          className={cn(
            "grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-10 lg:gap-x-8",
            showInventory ? "lg:grid-cols-4" : "lg:grid-cols-3"
          )}
        >
          {/* Brand + contact */}
          <div className="min-w-0 border-b border-white/10 pb-10 sm:border-b-0 sm:pb-0">
            <FullPageLink href={ROUTES.corporate.home} className="inline-block">
              <Logo
                variant="white"
                brand={brand}
                height={48}
                srcOverride={global.logoWhiteUrl || undefined}
                iconSrcOverride={global.logoIconWhiteUrl || undefined}
                alt={global.siteName}
              />
            </FullPageLink>
            <p className="mt-4 max-w-lg text-sm font-light leading-relaxed text-white/70">
              {footer.tagline}
            </p>
            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group grid grid-cols-[2rem_1fr] items-start gap-3"
                >
                  <ContactIcon>
                    <MapPin className="size-4" aria-hidden="true" />
                  </ContactIcon>
                  <span
                    className={`pt-1 ${contactTextClass} group-hover:underline`}
                  >
                    {footer.addressLine1}
                    <br />
                    {footer.addressLine2}
                  </span>
                </a>
              </li>
              <li className="grid grid-cols-[2rem_1fr] items-start gap-3">
                <ContactIcon>
                  <Phone className="size-4" aria-hidden="true" />
                </ContactIcon>
                <div className="flex min-w-0 flex-col gap-1 pt-1">
                  <a
                    href={`tel:${phoneTel}`}
                    className="text-sm text-white/85 transition-colors hover:text-white"
                  >
                    {footer.phone}
                  </a>
                  <a
                    href={`tel:${phoneTel}`}
                    className="inline-flex w-fit text-sm font-medium text-white/90 transition-colors hover:text-white"
                  >
                    Call now
                  </a>
                </div>
              </li>
              <li>
                <a
                  href={`mailto:${footer.email}`}
                  className="group grid grid-cols-[2rem_1fr] items-start gap-3"
                >
                  <ContactIcon>
                    <Mail className="size-4" aria-hidden="true" />
                  </ContactIcon>
                  <span
                    className={`break-all pt-1 ${contactTextClass} group-hover:underline`}
                  >
                    {footer.email}
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <FooterSection title="Company">
            <ul className="space-y-0.5">
              <li>
                <InstallCustomerAppButton display="footer" />
              </li>
              {footerCompanyLinks.map((link) => (
                <li key={link.href}>
                  <FullPageLink href={link.href} className={footerLinkClass}>
                    {link.label}
                  </FullPageLink>
                </li>
              ))}
            </ul>
          </FooterSection>

          {showInventory && (
            <FooterSection title="Inventory">
              <ul className="space-y-0.5">
                {footerInventoryLinks.map((link) => (
                  <li key={link.href}>
                    <FullPageLink href={link.href} className={footerLinkClass}>
                      {link.label}
                    </FullPageLink>
                  </li>
                ))}
              </ul>
            </FooterSection>
          )}

          <FooterSection title="Newsletter">
            <p className="text-sm leading-relaxed text-white/75">
              {footer.newsletterDescription}
            </p>
            <NewsletterForm />

            {socials.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                  Follow us
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {socials.map((social) => (
                    <li key={social.label}>
                      <a
                        href={social.href.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-brand-cta-gold/40 hover:text-brand-cta-gold"
                      >
                        {social.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </FooterSection>
        </div>

        {/* Copyright & legal */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-8 text-center sm:flex-row sm:justify-between sm:text-left lg:mt-12 lg:pt-8">
          <p className="text-xs text-white/70">
            © {new Date().getFullYear()} {global.siteName}. All rights
            reserved.
          </p>
          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {footerLegalLinks.map((link) => (
              <FullPageLink
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center text-xs text-white/65 transition-colors hover:text-brand-cta-gold"
              >
                {link.label}
              </FullPageLink>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
