"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, KeyRound, Shield } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { SecuritySettings } from "@/components/platform/security-settings";

function AccountSecurityContent() {
  const searchParams = useSearchParams();
  const forcedChange = searchParams.get("required") === "1";

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title={forcedChange ? "Set a new password" : "Account security"}
        description={
          forcedChange
            ? "You must set a new password before continuing."
            : "Change your password and manage passkeys for your platform account."
        }
        breadcrumb={forcedChange ? "Required password change" : "Account security"}
      />

      {forcedChange ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Your account is using a temporary password assigned by an administrator. Choose a
            personal password below to access the platform.
          </p>
        </div>
      ) : null}

      <section className="platform-card min-w-0 space-y-4 rounded-xl p-4 sm:p-6">
        {!forcedChange ? (
          <>
            <div className="flex items-start gap-3 border-b border-[var(--platform-border)] pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[rgba(107,33,168,0.12)] text-[var(--platform-accent)]">
                <Shield className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--platform-text)]">
                  Password &amp; sign-in
                </h2>
                <p className="text-sm text-[var(--platform-text-secondary)]">
                  After your first sign-in, update the temporary password assigned by an admin.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--platform-text-secondary)]">
              <KeyRound className="size-3.5 shrink-0" aria-hidden />
              Available to every team role once you are signed in.
            </div>
          </>
        ) : null}
        <SecuritySettings forcedChange={forcedChange} />
      </section>
    </div>
  );
}

/**
 * Account security for every signed-in platform role (staff to owner).
 * Not gated by the Settings permission — managers/staff can change their password here.
 */
export default function AccountSecurityPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--platform-text-secondary)]">Loading security settings…</p>
      }
    >
      <AccountSecurityContent />
    </Suspense>
  );
}