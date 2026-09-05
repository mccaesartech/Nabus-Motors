"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { Heart, Menu, Search, User, X } from "lucide-react";
import { LogoWordmark } from "@/components/shared/logo";
import { FullPageLink } from "@/components/shared/full-page-link";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useGarage } from "@/hooks/use-garage";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";
import { ROUTES } from "@/lib/routes";
import { NABUS_PRIMARY_NAV, NABUS_UTILITY_LINKS } from "@/lib/nabus/nav";
import { NabusSearchLayer } from "@/components/nabus/nabus-search-layer";
import type { SiteContent } from "@/lib/site-content/defaults";
import { cn } from "@/lib/utils";

type FoldHeaderProps = {
  content: SiteContent;
  transparent?: boolean;
};

function isNavActive(
  href: string,
  pathname: string,
  searchParams: ReadonlyURLSearchParams | null
): boolean {
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
    return !searchParams?.get("sort") && searchParams?.get("status") !== "pre_order";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function FoldHeaderInner({
  content,
  searchParams,
  transparent = false,
}: FoldHeaderProps & { searchParams: ReadonlyURLSearchParams | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading: authLoading } = useCustomerAuth();
  const { savedIds } = useGarage();

  const solid = !transparent || scrolled;

  useLockBodyScroll(mobileOpen);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const swipeHandlers = useSwipeToClose({
    enabled: mobileOpen,
    onClose: closeMobile,
    direction: "right",
  });

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const linkClass = (href: string) =>
    cn(
      "relative whitespace-nowrap px-2 py-2 text-[13px] tracking-[0.01em] transition-colors duration-200",
      isNavActive(href, pathname, searchParams)
        ? solid
          ? "text-[var(--nabus-wine)]"
          : "text-[var(--nabus-paper)]"
        : solid
          ? "text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]"
          : "text-[var(--nabus-paper)]/88 hover:text-[var(--nabus-paper)]"
    );

  const iconBtnClass = cn(
    "inline-flex min-h-10 min-w-10 items-center justify-center transition-colors duration-200",
    solid
      ? "text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]"
      : "text-[var(--nabus-paper)] hover:text-[var(--nabus-gold)]"
  );

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50">
        <header
          className={cn(
            "transition-[background-color,border-color] duration-250",
            solid
              ? "border-b border-[var(--nabus-border)] bg-[var(--nabus-paper)]"
              : "border-b border-transparent bg-transparent"
          )}
        >
          <div className="mx-auto flex h-[var(--header-height)] max-w-[92rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-10">
            <FullPageLink href={ROUTES.auto.home} className="shrink-0">
              <LogoWordmark
                variant={solid ? "purple" : "white"}
                brand="auto"
                priority
                className="h-8 w-auto max-w-[9rem] sm:h-9 sm:max-w-[10rem]"
                srcOverride={
                  solid
                    ? content.global.logoPurpleUrl || "/logo.png"
                    : content.global.logoWhiteUrl || content.global.logoPurpleUrl || "/logo.png"
                }
                alt={content.global.siteName}
              />
            </FullPageLink>

            <nav
              className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
              aria-label="Main"
            >
              {NABUS_PRIMARY_NAV.map((item) =>
                item.href ? (
                  <FullPageLink key={item.href} href={item.href} className={linkClass(item.href)}>
                    {item.label}
                  </FullPageLink>
                ) : null
              )}
            </nav>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={iconBtnClass}
                aria-label="Search"
              >
                <Search className="size-[17px]" strokeWidth={1.5} />
              </button>

              <FullPageLink
                href={ROUTES.auto.garage}
                className={cn(iconBtnClass, "relative hidden sm:inline-flex")}
                aria-label="Saved vehicles"
              >
                <Heart className="size-[17px]" strokeWidth={1.5} />
                {savedIds.length > 0 ? (
                  <span className="absolute right-1 top-1 size-1.5 bg-[var(--nabus-wine)]" />
                ) : null}
              </FullPageLink>

              {!authLoading && user ? (
                <FullPageLink
                  href={ROUTES.corporate.account}
                  className={cn(iconBtnClass, "hidden sm:inline-flex")}
                  aria-label="Account"
                >
                  <User className="size-[17px]" strokeWidth={1.5} />
                </FullPageLink>
              ) : (
                <FullPageLink
                  href={ROUTES.corporate.login}
                  className={cn(iconBtnClass, "hidden sm:inline-flex")}
                  aria-label="Sign in"
                >
                  <User className="size-[17px]" strokeWidth={1.5} />
                </FullPageLink>
              )}

              <FullPageLink
                href={ROUTES.corporate.contact}
                className={cn(
                  "ml-2 hidden text-[13px] tracking-wide transition-colors duration-200 lg:inline-flex",
                  solid
                    ? "text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]"
                    : "text-[var(--nabus-paper)] hover:text-[var(--nabus-gold)]"
                )}
              >
                Visit Dzorwulu
              </FullPageLink>

              <button
                type="button"
                className={cn(iconBtnClass, "lg:hidden")}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
        </header>
      </div>

      <NabusSearchLayer open={searchOpen} onClose={() => setSearchOpen(false)} />

      <button
        type="button"
        aria-label="Close menu"
        tabIndex={mobileOpen ? 0 : -1}
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-[var(--nabus-graphite)]/45 transition-opacity duration-200 lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />

      <aside
        aria-label="Mobile navigation"
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[45] flex w-[min(100dvw-2.5rem,20rem)] flex-col border-l border-[var(--nabus-border)] bg-[var(--nabus-paper)] transition-transform duration-250 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
        {...swipeHandlers}
      >
        <div className="flex items-center justify-between border-b border-[var(--nabus-border)] px-4 py-3">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--nabus-muted)]">
            NB / MENU
          </span>
          <button type="button" onClick={closeMobile} className="inline-flex min-h-10 min-w-10 items-center justify-center">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NABUS_PRIMARY_NAV.map((item) =>
            item.href ? (
              <FullPageLink
                key={item.href}
                href={item.href}
                className={cn(
                  "mb-1 block px-3 py-2.5 text-base transition-colors",
                  isNavActive(item.href, pathname, searchParams)
                    ? "text-[var(--nabus-wine)]"
                    : "text-[var(--nabus-graphite)] hover:text-[var(--nabus-wine)]"
                )}
                onClick={closeMobile}
              >
                {item.label}
              </FullPageLink>
            ) : null
          )}
          <div className="my-4 w-[calc(100%-2rem)] border-t border-[var(--nabus-border)] pt-4">
            {NABUS_UTILITY_LINKS.map((link) => (
              <FullPageLink
                key={link.href}
                href={link.href}
                className="block px-3 py-2.5 text-sm text-[var(--nabus-muted)] hover:text-[var(--nabus-wine)]"
                onClick={closeMobile}
              >
                {link.label}
              </FullPageLink>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}

export function FoldHeaderStatic(props: FoldHeaderProps) {
  return <FoldHeaderInner {...props} searchParams={null} />;
}

export function FoldHeader(props: FoldHeaderProps) {
  const searchParams = useSearchParams();
  return <FoldHeaderInner {...props} searchParams={searchParams} />;
}
