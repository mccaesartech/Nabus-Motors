"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

type FreightFormAccountFieldsProps = {
  isGuest: boolean;
  phone: string;
  onPhoneChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  phoneId: string;
  phoneRequired?: boolean;
};

export function FreightFormAccountFields({
  isGuest,
  phone,
  onPhoneChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  phoneId,
  phoneRequired = true,
}: FreightFormAccountFieldsProps) {
  return (
    <>
      {(isGuest || !phone.trim()) && (
        <div className="space-y-1.5">
          <Label htmlFor={phoneId}>Phone *</Label>
          <Input
            id={phoneId}
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            required={phoneRequired}
            autoComplete="tel"
          />
        </div>
      )}

      {isGuest && (
        <div className="space-y-3 sm:col-span-2">
          <p className="text-sm font-semibold text-foreground">
            Create your account to track quotes and shipments
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${phoneId}-password`}>Password *</Label>
              <PasswordInput
                id={`${phoneId}-password`}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${phoneId}-confirm-password`}>Confirm password *</Label>
              <PasswordInput
                id={`${phoneId}-confirm-password`}
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Already have an account? Enter your existing password above to sign in when you
              submit.{" "}
              <Link href="/login" className="font-medium text-brand-purple hover:underline">
                Sign in separately
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

type FreightSubmitSuccessProps = {
  referenceCode: string;
  trackingNumber?: string | null;
  accountCreated?: boolean;
  signedIn?: boolean;
  message?: string;
};

export function FreightSubmitSuccess({
  referenceCode,
  trackingNumber,
  accountCreated,
  signedIn,
  message,
}: FreightSubmitSuccessProps) {
  return (
    <div className="space-y-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-6 text-emerald-950">
      <div>
        <p className="text-lg font-semibold">Thank you for choosing True Goshen Company Limited</p>
        <p className="mt-1 text-sm text-emerald-900/90">
          Your quote request was received. Save your quote reference below — we also send it by
          email or WhatsApp when those channels are configured.
        </p>
      </div>
      <div className="rounded-md border border-emerald-200 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
          Your quote reference
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-emerald-950">
          {referenceCode}
        </p>
        <p className="mt-2 text-xs text-emerald-800/90">
          Use this reference on our tracking page with your email or phone. After we convert your
          quote to a shipment, you will receive a separate tracking number.
        </p>
      </div>
      {message && <p className="text-sm">{message}</p>}
      {trackingNumber && (
        <div className="rounded-md border border-emerald-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
            Shipment tracking number
          </p>
          <p className="mt-1 font-mono text-xl font-semibold">{trackingNumber}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/freight-forwarding/tracking"
          className="inline-flex items-center rounded-md bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
        >
          Track your quote
        </Link>
        {signedIn || accountCreated ? (
          <Link
            href="/account#shipment-tracking"
            className="inline-flex items-center rounded-md border border-emerald-300 px-4 py-2 font-medium text-emerald-900 hover:bg-emerald-100"
          >
            Open your dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center rounded-md border border-emerald-300 px-4 py-2 font-medium text-emerald-900 hover:bg-emerald-100"
          >
            Sign in to track
          </Link>
        )}
      </div>
    </div>
  );
}

type LoggedInContactBannerProps = {
  name: string;
  email: string;
  phone?: string | null;
  className?: string;
};

export function LoggedInContactBanner({
  name,
  email,
  phone,
  className,
}: LoggedInContactBannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-3 text-sm sm:col-span-2",
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-purple">
        Contacting as
      </p>
      <p className="mt-1 font-medium text-foreground">
        {name}
        <span className="text-muted-foreground"> · </span>
        {email}
        {phone ? (
          <>
            <span className="text-muted-foreground"> · </span>
            {phone}
          </>
        ) : null}
      </p>
    </div>
  );
}

export function useFreightFormProfile() {
  const { user, profile, displayName } = useCustomerAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    if (displayName) setName(displayName);
    if (user.email) setEmail(user.email);
    if (profile?.phone) setPhone(profile.phone);
  }, [user, displayName, user?.email, profile?.phone]);

  return {
    user,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    isGuest: !user,
  };
}
