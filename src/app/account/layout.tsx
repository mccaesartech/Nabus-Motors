import { AccountPortalNav } from "@/components/account/account-portal-nav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-var(--shell-top-offset))] bg-[var(--nabus-ivory)]">
      <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 xl:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          <aside className="lg:w-48 lg:shrink-0">
            <AccountPortalNav />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
