"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileAvatarViewer } from "@/components/account/profile-avatar-viewer";
import { useCustomerAuth } from "@/context/customer-auth-context";
import type { PreferredContact } from "@/lib/customer/profile";

type ProfilePayload = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  registration_id: string | null;
  avatar_url: string | null;
  uploaded_avatar_url?: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  preferred_contact: PreferredContact | null;
  member_since: string | null;
  auth_provider: string;
};

const selectClassName =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function ProfileSettingsSection() {
  const { user, displayName, getAccessToken, refreshProfile } = useCustomerAuth();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [preferredContact, setPreferredContact] = useState<PreferredContact | "">("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState("Email");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasUploadedAvatar, setHasUploadedAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyProfile(profile: ProfilePayload) {
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setAddressLine(profile.address_line ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country ?? "");
    setPreferredContact(profile.preferred_contact ?? "");
    setEmail(profile.email ?? user?.email ?? "");
    setRegistrationId(profile.registration_id);
    setMemberSince(profile.member_since);
    setAuthProvider(profile.auth_provider || "Email");
    setAvatarUrl(profile.avatar_url);
    setHasUploadedAvatar(Boolean(profile.uploaded_avatar_url));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) {
          setError("Your session expired. Please sign in again.");
          setLoading(false);
        }
        return;
      }

      const res = await fetch("/api/customer/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (cancelled) return;

      if (!res.ok || !body?.ok || !body.profile) {
        setError(body?.message || "Could not load your profile.");
        setLoading(false);
        return;
      }

      applyProfile(body.profile as ProfilePayload);

      if (!body.profile.first_name && displayName && displayName !== user?.email?.split("@")[0]) {
        const parts = displayName.trim().split(/\s+/);
        if (parts[0]) setFirstName(parts[0]);
        if (parts.length > 1 && !body.profile.last_name) {
          setLastName(parts.slice(1).join(" "));
        }
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per signed-in user
  }, [user?.id]);

  const initials = (displayName || user?.email || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "C";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const token = await getAccessToken();
    if (!token) {
      setError("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/customer/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        addressLine,
        city,
        country,
        preferredContact: preferredContact || null,
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      setError(body?.message || "Could not save your profile.");
      setSaving(false);
      return;
    }

    if (body.profile) applyProfile(body.profile as ProfilePayload);
    await refreshProfile();
    setMessage(body.message || "Profile updated.");
    setSaving(false);
  }

  if (loading) {
    return (
      <section className="rounded-lg border p-5">
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProfileAvatarViewer
          avatarUrl={avatarUrl}
          hasUploadedAvatar={hasUploadedAvatar}
          initials={initials}
          size="lg"
          getAccessToken={getAccessToken}
          onError={(msg) => {
            setError(msg);
            if (msg) setMessage("");
          }}
          onMessage={(msg) => {
            setMessage(msg);
            setError("");
          }}
          onAvatarChange={async (next) => {
            setAvatarUrl(next.avatarUrl);
            setHasUploadedAvatar(next.hasUploadedAvatar);
            await refreshProfile();
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-brand-purple" />
            <h2 className="text-lg font-semibold">Your profile</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your details current so we can reach you about orders, visits, and deliveries.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Tap your photo to view it larger, then change or remove it.
            {!hasUploadedAvatar && avatarUrl
              ? " Showing your Google photo until you upload your own."
              : null}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Registration ID
          </dt>
          <dd className="mt-1 font-mono text-base font-semibold text-brand-purple">
            {registrationId ?? "—"}
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            Quote this ID when contacting Nabus Motors. It is unique to your account.
          </p>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </dt>
          <dd className="mt-1 break-all font-medium">{email || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sign-in method
          </dt>
          <dd className="mt-1 font-medium">{authProvider}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Member since
          </dt>
          <dd className="mt-1 font-medium">{memberSince ?? "—"}</dd>
        </div>
      </dl>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              maxLength={80}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+233…"
              maxLength={32}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-preferred-contact">Preferred contact</Label>
            <select
              id="profile-preferred-contact"
              className={selectClassName}
              value={preferredContact}
              onChange={(e) =>
                setPreferredContact((e.target.value || "") as PreferredContact | "")
              }
            >
              <option value="">No preference</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-address">Address (optional)</Label>
          <Input
            id="profile-address"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            autoComplete="street-address"
            maxLength={160}
            placeholder="Street, area, landmark"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-city">City</Label>
            <Input
              id="profile-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-country">Country</Label>
            <Input
              id="profile-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              autoComplete="country-name"
              maxLength={80}
              placeholder="Ghana"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Email is tied to your sign-in method and cannot be changed here.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <Button type="submit" disabled={saving} className="min-h-10">
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </section>
  );
}
