"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, User, X } from "lucide-react";
import { LogoWordmark } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { FullPageLink } from "@/components/shared/full-page-link";
import { cn } from "@/lib/utils";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useCustomerNotificationCount } from "@/context/customer-notifications-context";
import { NotificationCountBadge } from "@/components/customer/notification-count-badge";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";
import { CORPORATE_NAV_LINKS, ROUTES } from "@/lib/routes";
import type { SiteContent } from "@/lib/site-content/defaults";

type CorporateHeaderProps = {
  content: SiteContent;
  showFreightNav?: boolean;
};

export function CorporateHeader({ content, showFreightNav = true }: CorporateHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navLinkClassName = (href: string) =>
    cn(
      "relative shrink-0 whitespace-nowrap px-2 py-2 text-[13px] font-medium tracking-wide transition-colors duration-200 lg:px-2.5 xl:px-3",
      isActive(href)
        ? "text-white after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-brand-cta-gold"
        : "text-white/80 hover:text-white hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:h-px after:w-full hover:after:bg-white/40"
    );

  const { global } = content;

  const navLinks = showFreightNav
    ? CORPORATE_NAV_LINKS
    : CORPORATE_NAV_LINKS.filter((link) => link.href !== ROUTES.corporate.freight);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 w-full border-b border-white/10 bg-brand-black transition-shadow duration-300",
        scrolled && "shadow-luxury"
      )}
    >
      <div className="flex h-[var(--header-height)] w-full min-w-0 items-center">
        <Container className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 lg:gap-4">
          <FullPageLink href={ROUTES.corporate.home} className="shrink-0">
            <LogoWordmark
              variant="white"
              brand="corporate"
              priority
              className="max-w-[9.25rem] sm:max-w-none"
              srcOverride={global.logoWhiteUrl || undefined}
              alt={global.siteName}
            />
          </FullPageLink>

          <nav
            className="col-start-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:ml-[var(--header-logo-spacing)] lg:flex xl:gap-1 [&::-webkit-scrollbar]:hidden"
            aria-label="Corporate"
          >
            {navLinks.map((link) => (
              <FullPageLink
                key={link.href}
                href={link.href}
                className={navLinkClassName(link.href)}
              >
                {link.href === ROUTES.corporate.freight ? (
                  <>
                    <span className="xl:hidden">Freight</span>
                    <span className="hidden xl:inline">{link.label}</span>
                  </>
                ) : (
                  link.label
                )}
              </FullPageLink>
            ))}
          </nav>

          <div className="col-start-3 flex min-w-0 shrink-0 items-center justify-end gap-1.5 bg-brand-black pl-1 sm:gap-2 sm:pl-2">
            <div className="hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2">
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
            </div>

            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/20 text-white lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </Container>
      </div>

      <button
        type="button"
        aria-label="Close menu"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        className={cn(
          "fixed inset-0 z-40 bg-black/55 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-[2px] lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />

      <aside
        id="corporate-mobile-nav"
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-y-0 right-0 z-[45] flex w-[min(100vw-3rem,19rem)] flex-col border-l border-white/10 bg-brand-charcoal shadow-xl transition-transform duration-300 ease-out will-change-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
        {...swipeToCloseHandlers}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-medium tracking-wide text-white">Menu</span>
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/20 text-white"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
          {navLinks.map((link) => (
            <FullPageLink
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(link.href) ? "text-white" : "text-white/70 hover:text-white"
              )}
              onClick={closeMobile}
            >
              {link.label}
            </FullPageLink>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-4">
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
          </div>
        </nav>
      </aside>
    </header>
  );
}
