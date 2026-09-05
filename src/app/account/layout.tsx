import { Container } from "@/components/shared/container";
import { AccountPortalNav } from "@/components/account/account-portal-nav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-10 sm:py-14">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="lg:w-52 lg:shrink-0">
          <AccountPortalNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Container>
  );
}
