import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";
import { Separator } from "@/components/ui/separator";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import {
  GHANA_PHONE_DISPLAY,
  GHANA_PHONE_TEL,
} from "@/lib/data/vehicle-images";

const footerLinks = {
  company: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/financing", label: "Financing" },
    { href: "/sell", label: "Sell Your Vehicle" },
  ],
  inventory: [
    { href: "/inventory", label: "All Inventory" },
    { href: "/inventory?bodyType=SUV", label: "SUVs" },
    { href: "/inventory?bodyType=Sedan", label: "Sedans" },
    { href: "/inventory?bodyType=Luxury", label: "Luxury" },
    { href: "/inventory?bodyType=Truck", label: "Trucks" },
    { href: "/inventory?bodyType=Electric", label: "Electric" },
    { href: "/inventory?make=BYD", label: "Chinese Brands" },
  ],
  legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Conditions" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-brand-charcoal text-white">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Logo variant="light" />
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Your Safe Place for Quality Vehicles. Verified inventory, transparent
              pricing, and professional service you can trust.
            </p>
            <div className="mt-5 space-y-1 text-sm text-text-secondary">
              <p>Ring Road East, Accra</p>
              <p>Greater Accra, Ghana</p>
              <p>
                <a href={`tel:${GHANA_PHONE_TEL}`} className="hover:text-brand-gold">
                  {GHANA_PHONE_DISPLAY}
                </a>
              </p>
              <p>
                <a
                  href="mailto:info@truegoshenauto.com"
                  className="hover:text-brand-gold"
                >
                  info@truegoshenauto.com
                </a>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-gold">
              Company
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors duration-200 hover:text-brand-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-gold">
              Inventory
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.inventory.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors duration-200 hover:text-brand-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-gold">
              Newsletter
            </h3>
            <p className="mt-4 text-sm text-white/70">
              Receive new inventory alerts and exclusive offers.
            </p>
            <NewsletterForm />
            <div className="mt-6 flex gap-4">
              {["Facebook", "Instagram", "LinkedIn"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-xs font-medium uppercase tracking-wider text-white/50 hover:text-brand-gold"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-10 bg-white/10" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} True Goshen Auto. All rights reserved.
          </p>
          <div className="flex gap-6">
            {footerLinks.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-white/50 hover:text-white/80"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
