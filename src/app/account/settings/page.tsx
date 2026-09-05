"use client";

import Link from "next/link";
import { AccountSettingsShell } from "@/components/account/account-settings-nav";
import { ProfileSettingsSection } from "@/components/account/profile-settings-section";
import { useRequireCustomerAuth } from "@/hooks/use-require-customer-auth";

export default function AccountSettingsPage() {
  const { user, loading } = useRequireCustomerAuth();

  if (loading || !user) {
    return <p className="text-sm text-[var(--nabus-text-secondary)]">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
        <AccountSettingsShell
          title="Account settings"
          description="View and update your profile, then manage privacy and security."
        >
          <ProfileSettingsSection />
          <div className="mt-6 space-y-4 rounded-lg border p-5">
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
  );
}
