"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { Heart, Menu, ShoppingCart, User, X } from "lucide-react";
import { LogoWordmark } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { FullPageLink } from "@/components/shared/full-page-link";
import { cn } from "@/lib/utils";
import { useSavedVehicleCount } from "@/hooks/use-garage";
import { usePartsCartCount } from "@/context/parts-cart-context";
import { CountrySelector } from "@/components/shared/country-selector";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useCustomerNotificationCount } from "@/context/customer-notifications-context";
import { NotificationCountBadge } from "@/components/customer/notification-count-badge";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";
import { InstallCustomerAppButton } from "@/components/pwa/install-customer-app-button";
import { ROUTES } from "@/lib/routes";
import type { SiteContent } from "@/lib/site-content/defaults";

type HeaderProps = {
  content: SiteContent;
};

function HeaderInner({
  content,
  searchParams,
}: HeaderProps & { searchParams: ReadonlyURLSearchParams | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { savedCount } = useSavedVehicleCount();
  const { cartCount } = usePartsCartCount();
  const { user, loading: authLoading } = useCustomerAuth();
  const notificationCount = useCustomerNotificationCount();

  useLockBodyScroll(mobileOpen);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const swipeToCloseHandlers = useSwipeToClose({
    enabled: mobileOpen,
    onClose: closeMobile,
    direction: "right",
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === ROUTES.corporate.home) return pathname === ROUTES.corporate.home;
    if (href === ROUTES.auto.home) return pathname === ROUTES.auto.home;

    const [path, queryString] = href.split("?");
    if (queryString) {
      if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
      if (!searchParams) return pathname === path;
      const expected = new URLSearchParams(queryString);
      for (const [key, value] of expected.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }

    if (path === ROUTES.auto.inventory && pathname === ROUTES.auto.inventory) {
      return searchParams?.get("status") !== "pre_order";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navLinks = content.header.navLinks;
  const { global } = content;

  const navLinkClassName = (href: string) =>
    cn(
      "relative shrink-0 whitespace-nowrap px-2 py-2 text-sm font-medium tracking-wide transition-colors duration-200 lg:px-2.5 xl:px-3",
      isActive(href)
        ? "text-white after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-brand-cta-gold"
        : "text-white/80 hover:text-white hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:h-px hover:after:w-full hover:after:bg-white/40"
    );

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 w-full border-b border-white/10 bg-brand-primary transition-shadow duration-300",
        scrolled && "shadow-luxury"
      )}
    >
      <div className="flex h-[var(--header-height)] w-full min-w-0 items-center">
        <Container className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <FullPageLink href={ROUTES.corporate.home} className="shrink-0">
              <LogoWordmark
                variant="white"
                brand="auto"
                priority
                className="h-9 max-w-[9.25rem] w-auto shrink-0 sm:h-[var(--header-logo-size)] sm:max-w-none"
                srcOverride={global.logoWhiteUrl || undefined}
                alt={global.siteName}
              />
            </FullPageLink>
            <span className="hidden text-white/30 sm:inline" aria-hidden="true">
              /
            </span>
            <FullPageLink
              href={ROUTES.auto.home}
              className={cn(
                "hidden whitespace-nowrap text-[11px] font-medium tracking-wide transition-colors sm:inline",
                isActive(ROUTES.auto.home)
                  ? "text-brand-cta-gold"
                  : "text-white/60 hover:text-white"
              )}
            >
              Auto Division
            </FullPageLink>
          </div>

          <nav
            className="col-start-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:ml-[var(--header-logo-spacing)] lg:flex xl:gap-1 [&::-webkit-scrollbar]:hidden"
            aria-label="Main"
          >
            <FullPageLink
              href={ROUTES.corporate.home}
              className={navLinkClassName(ROUTES.corporate.home)}
            >
              Company Home
            </FullPageLink>
            {navLinks.map((link) => (
              <FullPageLink
                key={link.href}
                href={link.href}
                className={navLinkClassName(link.href)}
              >
                {link.label}
              </FullPageLink>
            ))}
          </nav>

          <div className="col-start-3 flex min-w-0 shrink-0 items-center justify-end gap-1.5 bg-brand-primary pl-1 sm:gap-2 sm:pl-2">
            <CountrySelector
              compact
              className="relative z-10 hidden shrink-0 lg:flex"
            />

            <div className="hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2">
              <InstallCustomerAppButton />
              {!authLoading && user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative text-white/80 hover:bg-white/5 hover:text-brand-gold"
                  render={<FullPageLink href={ROUTES.corporate.account} />}
                >
                  <User className="size-3.5" />
                  My Account
                  <NotificationCountBadge count={notificationCount} />
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/80 hover:bg-white/5 hover:text-brand-gold"
                    render={<FullPageLink href={ROUTES.corporate.login} />}
                  >
                    <User className="size-3.5" />
                    Login
                  </Button>
                  <Button
                    variant="luxury"
                    size="sm"
                    render={<FullPageLink href={ROUTES.corporate.register} />}
                  >
                    Register
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="relative text-white/80 hover:bg-white/5 hover:text-brand-gold"
                render={<FullPageLink href={ROUTES.auto.cart} />}
              >
                <ShoppingCart className="size-3.5" />
                <span className="hidden xl:inline">Cart</span>
                <span className="sr-only xl:hidden">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-cta-gold text-[10px] font-semibold text-white">
                    {cartCount}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                className="relative"
                render={<FullPageLink href={ROUTES.auto.garage} />}
              >
                <Heart className="size-3.5" />
                <span className="hidden xl:inline">Saved Vehicles</span>
                <span className="sr-only xl:hidden">Saved Vehicles</span>
                {savedCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-cta-gold text-[10px] font-semibold text-white">
                    {savedCount}
                  </span>
                )}
              </Button>
            </div>

            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-white/20 text-white lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </Container>
      </div>

      <button
        type="button"
        aria-label="Close menu"
        tabIndex={mobileOpen ? 0 : -1}
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-black/55 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-[2px] lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />

      <aside
        id="mobile-nav"
        aria-label="Mobile navigation"
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[45] flex w-[min(100dvw-3rem,19rem)] flex-col border-l border-white/10 bg-brand-charcoal shadow-xl transition-transform duration-300 ease-out will-change-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
        {...swipeToCloseHandlers}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-medium tracking-wide text-white">Menu</span>
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/20 text-white"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
          aria-label="Mobile"
        >
          <FullPageLink
            href={ROUTES.corporate.home}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(ROUTES.corporate.home)
                ? "text-white"
                : "text-white/70 hover:text-white"
            )}
            onClick={closeMobile}
          >
            Company Home
          </FullPageLink>
          <FullPageLink
            href={ROUTES.auto.home}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(ROUTES.auto.home)
                ? "text-brand-cta-gold"
                : "text-white/70 hover:text-white"
            )}
            onClick={closeMobile}
          >
            Auto Division
          </FullPageLink>
          {navLinks.map((link) => (
            <FullPageLink
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "text-white"
                  : "text-white/70 hover:text-white"
              )}
              onClick={closeMobile}
            >
              {link.label}
            </FullPageLink>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-xs text-white/60">Country</span>
              <CountrySelector />
            </div>
            <InstallCustomerAppButton display="compact" onAfterClick={closeMobile} />
            {!authLoading && user ? (
              <Button
                variant="luxury"
                size="sm"
                className="relative"
                render={<FullPageLink href={ROUTES.corporate.account} />}
                onClick={closeMobile}
              >
                My Account
                {notificationCount > 0 && ` (${notificationCount})`}
              </Button>
            ) : (
              <>
                <Button
                  variant="luxury"
                  size="sm"
                  render={<FullPageLink href={ROUTES.corporate.login} />}
                  onClick={closeMobile}
                >
                  Login
                </Button>
                <Button
                  size="sm"
                  render={<FullPageLink href={ROUTES.corporate.register} />}
                  onClick={closeMobile}
                >
                  Register
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              render={<FullPageLink href={ROUTES.auto.cart} />}
              onClick={closeMobile}
            >
              Cart {cartCount > 0 && `(${cartCount})`}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              render={<FullPageLink href={ROUTES.auto.garage} />}
              onClick={closeMobile}
            >
              Saved Vehicles {savedCount > 0 && `(${savedCount})`}
            </Button>
          </div>
        </nav>
      </aside>
    </header>
  );
}

/** Static shell for Suspense fallback during prerender. */
export function HeaderStatic({ content }: HeaderProps) {
  return <HeaderInner content={content} searchParams={null} />;
}

export function Header({ content }: HeaderProps) {
  const searchParams = useSearchParams();
  return <HeaderInner content={content} searchParams={searchParams} />;
}
