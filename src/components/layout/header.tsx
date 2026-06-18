"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, User, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGarage } from "@/hooks/use-garage";

const navLinks = [
  { href: "/inventory", label: "Inventory" },
  { href: "/buy", label: "Buy a Vehicle" },
  { href: "/sell", label: "Sell a Vehicle" },
  { href: "/financing", label: "Financing" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { savedCount } = useGarage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-white/10 bg-brand-black transition-shadow duration-300",
        scrolled && "shadow-luxury"
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4 lg:h-[4.25rem]">
          <Logo variant="light" />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-[13px] font-medium tracking-wide transition-colors duration-200",
                  isActive(link.href)
                    ? "text-brand-purple"
                    : "text-white hover:text-brand-gold"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/5 hover:text-brand-gold"
              render={<Link href="/login" />}
            >
              <User className="size-3.5" />
              Login
            </Button>
            <Button
              variant="luxury"
              size="sm"
              render={<Link href="/register" />}
            >
              Register
            </Button>
            <Button
              size="sm"
              className="relative"
              render={<Link href="/garage" />}
            >
              <Heart className="size-3.5" />
              Saved Vehicles
              {savedCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-gold text-[10px] font-semibold text-brand-black">
                  {savedCount}
                </span>
              )}
            </Button>
          </div>

          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/20 text-white lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </Container>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-brand-charcoal lg:hidden">
          <Container className="py-4">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "text-brand-purple"
                      : "text-white hover:text-brand-gold"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-4">
                <Button
                  variant="luxury"
                  size="sm"
                  render={<Link href="/login" />}
                >
                  Login
                </Button>
                <Button size="sm" render={<Link href="/register" />}>
                  Register
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  render={<Link href="/garage" />}
                >
                  Saved Vehicles {savedCount > 0 && `(${savedCount})`}
                </Button>
              </div>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}
