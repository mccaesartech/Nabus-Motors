"use client";

import Link from "next/link";
import { Container } from "@/components/shared/container";
import { AccountSettingsShell } from "@/components/account/account-settings-nav";
import { useRequireCustomerAuth } from "@/hooks/use-require-customer-auth";

export default function AccountSettingsPage() {
  const { user, loading } = useRequireCustomerAuth();

  if (loading || !user) {
    return (
      <Container className="py-16 sm:py-20">
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </Container>
    );
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <AccountSettingsShell
          title="Account settings"
          description="Manage your account preferences and security."
        >
          <div className="space-y-4 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Privacy &amp; security</h2>
            <p className="text-sm text-muted-foreground">
              Control how your data is handled, including account deletion and recovery options.
            </p>
            <Link
              href="/account/settings/privacy"
              className="inline-flex min-h-10 items-center text-sm font-medium text-brand-purple hover:underline"
            >
              Go to Privacy &amp; Security →
            </Link>
          </div>
        </AccountSettingsShell>
      </div>
    </Container>
  );
}
