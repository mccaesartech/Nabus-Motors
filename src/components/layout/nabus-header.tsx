"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { ChevronDown, Menu, Search, User, X } from "lucide-react";
import { LogoWordmark } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { FullPageLink } from "@/components/shared/full-page-link";
import { cn } from "@/lib/utils";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";
import { ROUTES } from "@/lib/routes";
import { NABUS_PRIMARY_NAV, type NabusNavItem } from "@/lib/nabus/nav";
import { NabusSearchBar } from "@/components/nabus/nabus-search-bar";
import type { SiteContent } from "@/lib/site-content/defaults";

type NabusHeaderProps = {
  content: SiteContent;
  showSpareParts?: boolean;
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
    return searchParams?.get("status") !== "pre_order";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function filterNavItems(items: NabusNavItem[], showSpareParts: boolean): NabusNavItem[] {
  if (showSpareParts) return items;
  return items.map((item) => {
    if ("children" in item && item.children) {
      return {
        ...item,
        children: item.children.filter((c) => c.href !== ROUTES.auto.spareParts),
      };
    }
    return item;
  });
}

function NabusHeaderInner({
  content,
  searchParams,
  showSpareParts = true,
}: NabusHeaderProps & { searchParams: ReadonlyURLSearchParams | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const { user, loading: authLoading } = useCustomerAuth();
  const navItems = filterNavItems(NABUS_PRIMARY_NAV, showSpareParts);

  useLockBodyScroll(mobileOpen);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const swipeToCloseHandlers = useSwipeToClose({
    enabled: mobileOpen,
    onClose: closeMobile,
    direction: "right",
  });

  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const linkClass = (href: string) =>
    cn(
      "relative whitespace-nowrap px-2.5 py-2 text-sm font-semibold transition-colors duration-200",
      isNavActive(href, pathname, searchParams)
        ? "text-[var(--nabus-primary)] after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-0.5 after:rounded-full after:bg-[var(--nabus-primary)]"
        : "text-[var(--nabus-charcoal)] hover:text-[var(--nabus-primary)]"
    );

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <header className="border-b border-[var(--nabus-border)] bg-[var(--nabus-surface)]">
        <Container className="flex h-[var(--header-height)] items-center justify-between gap-3">
          <FullPageLink href={ROUTES.corporate.home} className="shrink-0">
            <LogoWordmark
              variant="purple"
              brand="auto"
              priority
              className="h-9 w-auto max-w-[9.5rem] sm:h-10 sm:max-w-[10.5rem]"
              srcOverride={content.global.logoPurpleUrl || "/logo.png"}
              alt={content.global.siteName}
            />
          </FullPageLink>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto lg:flex xl:gap-1 [&::-webkit-scrollbar]:hidden"
            aria-label="Main"
          >
            {navItems.map((item) => {
              if ("children" in item && item.children) {
                const isActive = item.children.some((c) =>
                  isNavActive(c.href, pathname, searchParams)
                );
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setServicesOpen(true)}
                    onMouseLeave={() => setServicesOpen(false)}
                  >
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-2 text-sm font-semibold transition-colors duration-200",
                        isActive || servicesOpen
                          ? "text-[var(--nabus-primary)]"
                          : "text-[var(--nabus-charcoal)] hover:text-[var(--nabus-primary)]"
                      )}
                      aria-expanded={servicesOpen}
                    >
                      {item.label}
                      <ChevronDown className="size-3.5" />
                    </button>
                    {servicesOpen ? (
                      <div className="absolute left-0 top-full z-50 min-w-[13rem] rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] p-2 shadow-[0_8px_24px_rgba(24,24,24,0.08)]">
                        {item.children.map((child) => (
                          <FullPageLink
                            key={child.href}
                            href={child.href}
                            className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--nabus-charcoal)] transition-colors hover:bg-[var(--nabus-red-soft)] hover:text-[var(--nabus-primary)]"
                          >
                            {child.label}
                          </FullPageLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              return (
                <FullPageLink key={item.href} href={item.href!} className={linkClass(item.href!)}>
                  {item.label}
                </FullPageLink>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-[var(--nabus-charcoal)] transition-colors hover:bg-[var(--nabus-background)] lg:hidden"
              aria-label="Search"
            >
              <Search className="size-5" />
            </button>

            <div className="hidden lg:block">
              <NabusSearchBar compact />
            </div>

            {!authLoading && user ? (
              <Button
                size="sm"
                variant="outline"
                className="hidden rounded-lg border-[var(--nabus-input-border)] lg:inline-flex"
                render={<FullPageLink href={ROUTES.corporate.account} />}
              >
                <User className="size-4" />
                Account
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="hidden rounded-lg text-[var(--nabus-charcoal)] lg:inline-flex"
                render={<FullPageLink href={ROUTES.corporate.login} />}
              >
                <User className="size-4" />
                Account
              </Button>
            )}

            <Button
              size="sm"
              className="hidden rounded-lg bg-[var(--nabus-primary)] hover:bg-[var(--nabus-primary-hover)] lg:inline-flex"
              render={<FullPageLink href={ROUTES.auto.inventory} />}
            >
              Find a Car
            </Button>

            <button
              type="button"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-[var(--nabus-charcoal)] lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="nabus-mobile-nav"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </Container>

        {searchOpen ? (
          <div className="border-t border-[var(--nabus-border)] px-4 py-3 lg:hidden">
            <NabusSearchBar />
          </div>
        ) : null}
      </header>

      <button
        type="button"
        aria-label="Close menu"
        tabIndex={mobileOpen ? 0 : -1}
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-[var(--nabus-charcoal)]/40 transition-opacity duration-200 lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />

      <aside
        id="nabus-mobile-nav"
        aria-label="Mobile navigation"
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[45] flex w-[min(100dvw-2.5rem,20rem)] flex-col border-l border-[var(--nabus-border)] bg-[var(--nabus-surface)] shadow-2xl transition-transform duration-200 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
        {...swipeToCloseHandlers}
      >
        <div className="flex items-center justify-between border-b border-[var(--nabus-border)] px-4 py-3">
          <LogoWordmark
            variant="purple"
            brand="auto"
            className="h-8 w-auto max-w-[8rem]"
            srcOverride={content.global.logoPurpleUrl || "/logo.png"}
            alt={content.global.siteName}
          />
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-[var(--nabus-border)] px-4 py-3">
          <NabusSearchBar />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
          {navItems.map((item) => {
            if ("children" in item && item.children) {
              return (
                <div key={item.label} className="mb-2">
                  <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--nabus-text-secondary)]">
                    {item.label}
                  </p>
                  {item.children.map((child) => (
                    <FullPageLink
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                        isNavActive(child.href, pathname, searchParams)
                          ? "bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]"
                          : "text-[var(--nabus-charcoal)] hover:bg-[var(--nabus-background)]"
                      )}
                      onClick={closeMobile}
                    >
                      {child.label}
                    </FullPageLink>
                  ))}
                </div>
              );
            }
            return (
              <FullPageLink
                key={item.href}
                href={item.href!}
                className={cn(
                  "mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  isNavActive(item.href!, pathname, searchParams)
                    ? "bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]"
                    : "text-[var(--nabus-charcoal)] hover:bg-[var(--nabus-background)]"
                )}
                onClick={closeMobile}
              >
                {item.label}
              </FullPageLink>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-[var(--nabus-border)] p-4">
          {!authLoading && user ? (
            <Button
              className="w-full rounded-lg bg-[var(--nabus-primary)]"
              render={<FullPageLink href={ROUTES.corporate.account} />}
              onClick={closeMobile}
            >
              My Account
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full rounded-lg border-[var(--nabus-input-border)]"
                render={<FullPageLink href={ROUTES.corporate.login} />}
                onClick={closeMobile}
              >
                Sign In
              </Button>
              <Button
                className="w-full rounded-lg bg-[var(--nabus-primary)]"
                render={<FullPageLink href={ROUTES.corporate.register} />}
                onClick={closeMobile}
              >
                Create Account
              </Button>
            </>
          )}
          <Button
            className="w-full rounded-lg bg-[var(--nabus-primary)]"
            render={<FullPageLink href={ROUTES.auto.inventory} />}
            onClick={closeMobile}
          >
            Find a Car
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function NabusHeaderStatic(props: NabusHeaderProps) {
  return <NabusHeaderInner {...props} searchParams={null} />;
}

export function NabusHeader(props: NabusHeaderProps) {
  const searchParams = useSearchParams();
  return <NabusHeaderInner {...props} searchParams={searchParams} />;
}
