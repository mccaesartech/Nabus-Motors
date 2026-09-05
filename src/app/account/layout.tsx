import { AccountPortalNav } from "@/components/account/account-portal-nav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-var(--shell-top-offset))] bg-[var(--nabus-ivory)]">
      <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <aside className="lg:w-56 lg:shrink-0">
            <AccountPortalNav />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
