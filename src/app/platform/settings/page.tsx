"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Database,
  ExternalLink,
  Mail,
  MessageCircle,
  Package,
  Save,
  Share2,
  Ship,
  Truck,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  adminErrorMessage,
  isAdminAuthError,
  parseAdminResponse,
  redirectToAdminLogin,
} from "@/lib/admin/client";
import { DEFAULT_SITE_SETTINGS, type SiteSettingKey } from "@/lib/platform/modules";

type SettingsMeta = {
  publicSiteUrl: string;
  autoSiteUrl: string;
  emailDelivery?: {
    resendConfigured: boolean;
    fromAddress: string;
    fromDomain: string | null;
    isResendSandbox: boolean;
    setupGuideUrl: string;
    warning: string | null;
  };
  notification?: {
    recommendedProvider: "termii" | null;
    termiiEnvConfigured: boolean;
  };
};

type DbHealth = {
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
  serviceRolePresent: boolean;
  tables: Record<string, boolean>;
  error: string | null;
};

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="platform-card space-y-4 rounded-xl p-6">
      <div className="flex items-start gap-3 border-b border-[var(--platform-border)] pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[rgba(107,33,168,0.12)] text-[var(--platform-accent)]">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--platform-text)]">{title}</h2>
          <p className="text-sm text-[var(--platform-text-secondary)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-[var(--platform-text-secondary)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--platform-text-secondary)]">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--platform-border)] px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-[var(--platform-text)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--platform-text-secondary)]">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="mt-1 size-4 rounded border-[var(--platform-border)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [meta, setMeta] = useState<SettingsMeta | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    const merged = { ...DEFAULT_SITE_SETTINGS, ...(json.settings ?? {}) };
    if (
      json.meta?.notification?.recommendedProvider === "termii" &&
      !merged.whatsapp_api_provider
    ) {
      merged.whatsapp_api_provider = "termii";
    }
    setSettings(merged);
    setMeta(json.meta ?? null);
    setDbHealth(json.db ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(settings),
    });
    const json = await parseAdminResponse(res);
    setSaving(false);
    if (isAdminAuthError(res)) {
      redirectToAdminLogin(router);
      setToast(adminErrorMessage(json, "Session expired. Please sign in again."));
      return;
    }
    if (res.ok && json.ok) {
      setToast(json.warning ? `Settings saved. ${json.warning}` : "Settings saved successfully.");
      setTimeout(() => setToast(""), 4000);
    } else {
      setToast(adminErrorMessage(json, "Failed to save settings."));
    }
  }

  function update(key: SiteSettingKey, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateBool(key: SiteSettingKey, value: boolean) {
    update(key, value ? "true" : "false");
  }

  function isOn(key: SiteSettingKey): boolean {
    return settings[key] === "true" || settings[key] === "1";
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Operational configuration — contact details, notifications, freight defaults, and system flags."
        breadcrumb="Settings"
        actions={
          <button type="submit" form="settings-form" disabled={saving} className="platform-btn-primary">
            <Save className="size-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        }
      />

      <div className="rounded-lg border border-[var(--platform-border)] bg-[rgba(107,33,168,0.06)] px-4 py-3 text-sm text-[var(--platform-text-secondary)]">
        For marketing copy, hero text, and page images, use{" "}
        <Link
          href="/platform/site-content"
          className="inline-flex items-center gap-1 font-medium text-[var(--platform-accent)] hover:underline"
        >
          Site Content
          <ExternalLink className="size-3.5" />
        </Link>
        . Settings here control operational values used across forms, notifications, and documents.
      </div>

      {toast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]">
          {toast}
        </div>
      )}

      {meta?.emailDelivery?.isResendSandbox && meta.emailDelivery.warning && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-red-700" />
            <div className="min-w-0 space-y-2">
              <p className="font-semibold">Resend sandbox detected — customer emails will not arrive</p>
              <p>{meta.emailDelivery.warning}</p>
              <p className="text-red-900">
                Current sender: <code className="rounded bg-red-100 px-1">{meta.emailDelivery.fromAddress}</code>
              </p>
              <a
                href={meta.emailDelivery.setupGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-red-800 underline"
              >
                Verify domain at Resend
                <ExternalLink className="size-3.5" />
              </a>
              <p className="text-xs text-red-800">
                Until your domain is verified, use Supabase Auth SMTP (Authentication → SMTP Settings)
                or copy reset links from the customer profile and send via WhatsApp.
              </p>
            </div>
          </div>
        </div>
      )}

      {dbHealth && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            dbHealth.connected && !dbHealth.error
              ? "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-text)]"
              : "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text)]"
          }`}
        >
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 size-5 shrink-0 text-[var(--platform-accent)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium">
                Database{" "}
                {dbHealth.connected && !dbHealth.error ? "connected" : "needs attention"}
                {dbHealth.latencyMs != null ? ` · ${dbHealth.latencyMs}ms` : ""}
              </p>
              {!dbHealth.configured && (
                <p className="text-[var(--platform-text-secondary)]">
                  Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
                  SUPABASE_SERVICE_ROLE_KEY in Vercel (or .env.local).
                </p>
              )}
              {dbHealth.configured && !dbHealth.serviceRolePresent && (
                <p className="text-[var(--platform-text-secondary)]">
                  SUPABASE_SERVICE_ROLE_KEY is missing — CMS and admin writes may not persist.
                </p>
              )}
              {dbHealth.error && (
                <p className="text-[var(--platform-text-secondary)]">{dbHealth.error}</p>
              )}
              {dbHealth.tables && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(dbHealth.tables).map(([table, ok]) => (
                    <span
                      key={table}
                      className={`rounded px-2 py-0.5 font-mono text-xs ${
                        ok
                          ? "bg-[rgba(16,185,129,0.15)] text-[var(--platform-success)]"
                          : "bg-[rgba(239,68,68,0.12)] text-[var(--platform-danger)]"
                      }`}
                    >
                      {table}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <form id="settings-form" onSubmit={handleSave} className="space-y-6">
        <SettingsSection
          icon={Building2}
          title="Company & Contact"
          description="Legal identity and contact channels for documents, forms, and customer communications."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company display name" className="sm:col-span-2">
              <input
                className="platform-input w-full"
                value={settings.company_name}
                onChange={(e) => update("company_name", e.target.value)}
              />
            </Field>
            <Field label="Company legal name">
              <input
                className="platform-input w-full"
                value={settings.company_legal_name}
                onChange={(e) => update("company_legal_name", e.target.value)}
              />
            </Field>
            <Field label="Tagline" hint="Short operational tagline — page marketing copy lives in Site Content.">
              <input
                className="platform-input w-full"
                value={settings.tagline}
                onChange={(e) => update("tagline", e.target.value)}
              />
            </Field>
            <Field label="Primary phone">
              <input
                className="platform-input w-full"
                value={settings.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
            <Field label="WhatsApp number">
              <input
                className="platform-input w-full"
                value={settings.whatsapp_number}
                onChange={(e) => update("whatsapp_number", e.target.value)}
                placeholder="233244876784"
              />
            </Field>
            <Field label="Primary email" className="sm:col-span-2">
              <input
                type="email"
                className="platform-input w-full"
                value={settings.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="Address line 1">
              <input
                className="platform-input w-full"
                value={settings.address_line1}
                onChange={(e) => update("address_line1", e.target.value)}
              />
            </Field>
            <Field label="Address line 2">
              <input
                className="platform-input w-full"
                value={settings.address_line2}
                onChange={(e) => update("address_line2", e.target.value)}
              />
            </Field>
            <Field label="Full address (legacy)" className="sm:col-span-2">
              <input
                className="platform-input w-full"
                value={settings.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </Field>
            <Field label="Google Maps URL" className="sm:col-span-2">
              <input
                className="platform-input w-full"
                value={settings.google_maps_url}
                onChange={(e) => update("google_maps_url", e.target.value)}
              />
            </Field>
            <Field label="Weekday hours">
              <input
                className="platform-input w-full"
                value={settings.hours_weekday}
                onChange={(e) => update("hours_weekday", e.target.value)}
              />
            </Field>
            <Field label="Saturday hours">
              <input
                className="platform-input w-full"
                value={settings.hours_saturday}
                onChange={(e) => update("hours_saturday", e.target.value)}
              />
            </Field>
            <Field label="Sunday hours" className="sm:col-span-2">
              <input
                className="platform-input w-full"
                value={settings.hours_sunday}
                onChange={(e) => update("hours_sunday", e.target.value)}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Package}
          title="Pre-order & Clearing"
          description="Operational notices and shipping option labels on the pre-order form."
        >
          <div className="grid gap-4">
            <Field label="Clearing fee notice">
              <textarea
                className="platform-input min-h-[6rem] w-full resize-y"
                value={settings.clearing_fee_notice ?? ""}
                onChange={(e) => update("clearing_fee_notice", e.target.value)}
              />
            </Field>
            <Field label="Shipping option A label">
              <input
                className="platform-input w-full"
                value={settings.preorder_terms_a}
                onChange={(e) => update("preorder_terms_a", e.target.value)}
              />
            </Field>
            <Field label="Shipping option B label">
              <input
                className="platform-input w-full"
                value={settings.preorder_terms_b}
                onChange={(e) => update("preorder_terms_b", e.target.value)}
              />
            </Field>
            <Field label="Shipping option C label">
              <input
                className="platform-input w-full"
                value={settings.preorder_terms_c}
                onChange={(e) => update("preorder_terms_c", e.target.value)}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Share2}
          title="Social & Links"
          description="Social profiles and public site URLs."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Facebook URL">
              <input
                className="platform-input w-full"
                value={settings.social_facebook}
                onChange={(e) => update("social_facebook", e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </Field>
            <Field label="Instagram URL">
              <input
                className="platform-input w-full"
                value={settings.social_instagram}
                onChange={(e) => update("social_instagram", e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </Field>
            <Field label="LinkedIn URL" className="sm:col-span-2">
              <input
                className="platform-input w-full"
                value={settings.social_linkedin}
                onChange={(e) => update("social_linkedin", e.target.value)}
                placeholder="https://linkedin.com/company/..."
              />
            </Field>
            <Field label="Corporate site URL (read-only)" className="sm:col-span-2">
              <input
                className="platform-input w-full bg-[var(--platform-bg-secondary)]"
                value={meta?.publicSiteUrl ?? ""}
                readOnly
              />
            </Field>
            <Field label="Auto division URL (read-only)" className="sm:col-span-2">
              <input
                className="platform-input w-full bg-[var(--platform-bg-secondary)]"
                value={meta?.autoSiteUrl ?? ""}
                readOnly
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Truck}
          title="Auto Division"
          description="Inventory defaults and appointment branch options."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default currency display">
              <select
                className="platform-input w-full"
                value={settings.default_currency_display}
                onChange={(e) => update("default_currency_display", e.target.value)}
              >
                <option value="GHS">GHS — Ghana Cedi</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </Field>
            <Field label="Low-stock threshold (vehicles)">
              <input
                type="number"
                min={0}
                className="platform-input w-full"
                value={settings.inventory_low_stock_threshold}
                onChange={(e) => update("inventory_low_stock_threshold", e.target.value)}
              />
            </Field>
            <Field
              label="Appointment branches"
              hint="One branch per line — used for test drives and viewings when booking is enabled."
              className="sm:col-span-2"
            >
              <textarea
                className="platform-input min-h-[5rem] w-full resize-y font-mono text-sm"
                value={settings.appointment_branches}
                onChange={(e) => update("appointment_branches", e.target.value)}
                placeholder={"Accra\nKumasi"}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Ship}
          title="Freight"
          description="Default origin countries and quote notification routing."
        >
          <div className="grid gap-4">
            <Field
              label="Default origin countries"
              hint="One country per line — shown as suggestions on freight quote forms."
            >
              <textarea
                className="platform-input min-h-[5rem] w-full resize-y font-mono text-sm"
                value={settings.freight_default_origins}
                onChange={(e) => update("freight_default_origins", e.target.value)}
                placeholder={"China\nJapan\nUSA"}
              />
            </Field>
            <Field label="Freight quote notification email">
              <input
                type="email"
                className="platform-input w-full"
                value={settings.freight_quote_notification_email}
                onChange={(e) => update("freight_quote_notification_email", e.target.value)}
              />
            </Field>
            <Field
              label="Cargo description options"
              hint="JSON array shown on freight quote and consultation forms. Each entry needs value, label, and optional sizes."
              className="sm:col-span-2"
            >
              <textarea
                className="platform-input min-h-[14rem] w-full resize-y font-mono text-xs"
                value={settings.freight_cargo_options}
                onChange={(e) => update("freight_cargo_options", e.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field label="General notification email">
              <input
                type="email"
                className="platform-input w-full"
                value={settings.notification_email}
                onChange={(e) => update("notification_email", e.target.value)}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={MessageCircle}
          title="Customer WhatsApp API"
          description="Automatic WhatsApp messages to customers on bookings. Env vars override these settings. Without API keys, wa.me links are logged for manual follow-up."
        >
          {meta?.notification?.recommendedProvider === "termii" && (
            <div className="rounded-lg border border-[var(--platform-accent)]/30 bg-[rgba(107,33,168,0.08)] px-4 py-3 text-sm text-[var(--platform-text)]">
              <p className="font-medium text-[var(--platform-accent)]">Termii recommended</p>
              <p className="mt-1 text-[var(--platform-text-secondary)]">
                Server env has <code className="rounded bg-[var(--platform-bg-secondary)] px-1">NOTIFICATION_PROVIDER=termii</code>{" "}
                or <code className="rounded bg-[var(--platform-bg-secondary)] px-1">WHATSAPP_PROVIDER=termii</code>.
                {meta.notification.termiiEnvConfigured
                  ? " Termii credentials are set in Vercel — env vars take priority over the fields below."
                  : " Add your Termii credentials below or set TERMII_* env vars in Vercel."}
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Provider"
              hint="termii (Ghana), twilio, or meta (Meta Cloud API). Leave blank to auto-detect from credentials."
            >
              <select
                className="platform-input w-full"
                value={settings.whatsapp_api_provider}
                onChange={(e) => update("whatsapp_api_provider", e.target.value)}
              >
                <option value="">Auto-detect from credentials</option>
                <option value="termii">
                  Termii (WhatsApp + SMS){meta?.notification?.recommendedProvider === "termii" ? " — recommended" : ""}
                </option>
                <option value="twilio">Twilio WhatsApp</option>
                <option value="meta">Meta WhatsApp Cloud API</option>
              </select>
            </Field>
            <Field label="Termii SMS channel" hint="dnd for transactional; generic for promotional">
              <select
                className="platform-input w-full"
                value={settings.termii_sms_channel || "dnd"}
                onChange={(e) => update("termii_sms_channel", e.target.value)}
              >
                <option value="dnd">DND (transactional)</option>
                <option value="generic">Generic</option>
              </select>
            </Field>
            <Field label="Termii API key" className="sm:col-span-2" hint="Or set TERMII_API_KEY in Vercel">
              <input
                type="password"
                className="platform-input w-full font-mono text-sm"
                value={settings.termii_api_key}
                onChange={(e) => update("termii_api_key", e.target.value)}
                placeholder="TLxxxxxxxx…"
                autoComplete="off"
              />
            </Field>
            <Field label="Termii sender ID" hint="Alphanumeric sender for SMS (max 11 chars)">
              <input
                className="platform-input w-full font-mono text-sm"
                value={settings.termii_sender_id}
                onChange={(e) => update("termii_sender_id", e.target.value)}
                placeholder="TrueGoshen"
              />
            </Field>
            <Field label="Termii WhatsApp device" hint="Device ID or phone for WhatsApp channel">
              <input
                className="platform-input w-full font-mono text-sm"
                value={settings.termii_whatsapp_device}
                onChange={(e) => update("termii_whatsapp_device", e.target.value)}
                placeholder="23490126727"
              />
            </Field>
            <Field label="Termii base URL" className="sm:col-span-2" hint="Default: https://api.ng.termii.com">
              <input
                className="platform-input w-full font-mono text-sm"
                value={settings.termii_base_url}
                onChange={(e) => update("termii_base_url", e.target.value)}
                placeholder="https://api.ng.termii.com"
              />
            </Field>
            <div className="sm:col-span-2 border-t border-[var(--platform-border)] pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
                Twilio / Meta (alternative providers)
              </p>
            </div>
            <Field label="Meta phone number ID" hint="Required for Meta Cloud API">
              <input
                className="platform-input w-full font-mono text-sm"
                value={settings.whatsapp_phone_number_id}
                onChange={(e) => update("whatsapp_phone_number_id", e.target.value)}
                placeholder="123456789012345"
              />
            </Field>
            <Field label="Meta access token" className="sm:col-span-2" hint="Or set WHATSAPP_ACCESS_TOKEN in Vercel">
              <input
                type="password"
                className="platform-input w-full font-mono text-sm"
                value={settings.whatsapp_api_access_token}
                onChange={(e) => update("whatsapp_api_access_token", e.target.value)}
                placeholder="EAAxxxx…"
                autoComplete="off"
              />
            </Field>
            <Field label="Twilio Account SID">
              <input
                className="platform-input w-full font-mono text-sm"
                value={settings.twilio_account_sid}
                onChange={(e) => update("twilio_account_sid", e.target.value)}
                placeholder="ACxxxxxxxx"
              />
            </Field>
            <Field label="Twilio Auth Token">
              <input
                type="password"
                className="platform-input w-full font-mono text-sm"
                value={settings.twilio_auth_token}
                onChange={(e) => update("twilio_auth_token", e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Twilio WhatsApp sender" className="sm:col-span-2" hint="E.g. +14155238886 or whatsapp:+14155238886">
              <input
                className="platform-input w-full font-mono text-sm"
                value={settings.twilio_whatsapp_from}
                onChange={(e) => update("twilio_whatsapp_from", e.target.value)}
                placeholder="+14155238886"
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="Email notification toggles — stored for future automation; flags are persisted now."
        >
          <div className="space-y-3">
            <Toggle
              label="Email notifications (master)"
              description="Global switch for outbound email alerts to the team."
              checked={isOn("notify_email_enabled")}
              onChange={(v) => updateBool("notify_email_enabled", v)}
            />
            <Toggle
              label="Pre-order inquiry alerts"
              checked={isOn("notify_preorders_enabled")}
              onChange={(v) => updateBool("notify_preorders_enabled", v)}
            />
            <Toggle
              label="Freight quote alerts"
              checked={isOn("notify_freight_quotes_enabled")}
              onChange={(v) => updateBool("notify_freight_quotes_enabled", v)}
            />
            <Toggle
              label="Low inventory alerts"
              checked={isOn("notify_low_stock_enabled")}
              onChange={(v) => updateBool("notify_low_stock_enabled", v)}
            />
            <Field
              label="Shipment update frequency"
              hint="How often customers receive WhatsApp/email on shipment changes. Every update includes notes and custom messages; milestones only sends status changes and one-click milestone chips."
            >
              <select
                className="platform-input w-full"
                value={settings.shipment_update_frequency || "every_update"}
                onChange={(e) => update("shipment_update_frequency", e.target.value)}
              >
                <option value="every_update">Every update</option>
                <option value="milestones_only">Milestones only</option>
              </select>
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Wrench}
          title="System"
          description="Maintenance mode and division visibility on public navigation."
        >
          <div className="space-y-4">
            <Toggle
              label="Maintenance mode"
              description="Shows a site-wide banner when enabled."
              checked={isOn("maintenance_mode")}
              onChange={(v) => updateBool("maintenance_mode", v)}
            />
            {isOn("maintenance_mode") ? (
              <Field label="Maintenance message">
                <textarea
                  className="platform-input min-h-[4rem] w-full resize-y"
                  value={settings.maintenance_message}
                  onChange={(e) => update("maintenance_message", e.target.value)}
                />
              </Field>
            ) : null}
            <div className="space-y-3 border-t border-[var(--platform-border)] pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
                Feature flags
              </p>
              <Toggle
                label="Show Spare Parts in Auto navigation"
                checked={isOn("feature_show_spare_parts_nav")}
                onChange={(v) => updateBool("feature_show_spare_parts_nav", v)}
              />
              <Toggle
                label="Show Freight & Clearing in corporate navigation"
                checked={isOn("feature_show_freight_nav")}
                onChange={(v) => updateBool("feature_show_freight_nav", v)}
              />
            </div>
          </div>
        </SettingsSection>
      </form>
    </div>
  );
}
