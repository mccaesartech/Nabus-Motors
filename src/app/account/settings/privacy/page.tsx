"use client";

import { Container } from "@/components/shared/container";
import { AccountSettingsShell } from "@/components/account/account-settings-nav";
import { DeleteAccountSection } from "@/components/account/delete-account-section";
import { getAccountRetentionDaysClient } from "@/lib/customer/account-lifecycle.shared";
import { useRequireCustomerAuth } from "@/hooks/use-require-customer-auth";

export default function AccountPrivacySettingsPage() {
  const { user, loading } = useRequireCustomerAuth();
  const retentionDays = getAccountRetentionDaysClient();

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
          title="Privacy & Security"
          description="Understand what happens to your data and manage account deletion."
        >
          <DeleteAccountSection retentionDays={retentionDays} />
        </AccountSettingsShell>
      </div>
    </Container>
  );
}
