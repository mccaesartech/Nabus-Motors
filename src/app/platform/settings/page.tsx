"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Coins,
  Download,
  ExternalLink,
  Package,
  Save,
  Share2,
  Shield,
  Ship,
  Truck,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { CargoOptionsEditor } from "@/components/platform/cargo-options-editor";
import { CurrencySettingsPanel } from "@/components/platform/currency-settings-panel";
import { SecuritySettings } from "@/components/platform/security-settings";
import { InstallAdminAppCard } from "@/components/pwa/install-admin-app-card";
import { InstallAdminAppBanner } from "@/components/pwa/install-admin-app-banner";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  adminErrorMessage,
  isAdminAuthError,
  parseAdminResponse,
  redirectToAdminLogin,
} from "@/lib/admin/client";
import { DEFAULT_SITE_SETTINGS, type SiteSettingKey } from "@/lib/platform/modules";
import { formatPlatformDateTime } from "@/lib/platform/datetime";

type SettingsMeta = {
  publicSiteUrl: string;
  autoSiteUrl: string;
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
    <section className="platform-card min-w-0 space-y-4 rounded-xl p-4 sm:p-6">
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
    setSettings({ ...DEFAULT_SITE_SETTINGS, ...(json.settings ?? {}) });
    setMeta(json.meta ?? null);
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
    <div className="min-w-0 max-w-full space-y-6">
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

      <InstallAdminAppBanner />

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
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="ZAR">ZAR — South African Rand</option>
              </select>
              <p className="mt-1.5 text-xs text-[var(--platform-text-secondary)]">
                Controls platform/admin money display only. Public visitors choose their own
                currency in the site UI — this setting never overrides them.
              </p>
            </Field>
            <Field
              label="Low-stock threshold (vehicles)"
              hint="Fleet-wide: alerts when total Available vehicles fall below this number. Separate urgent alerts also fire when a specific make/model/year is down to 0–1 units left (prompting Ghana availability or Pre-order)."
            >
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
          icon={Coins}
          title="Currency"
          description="Live ExchangeRate-API feed for storefront prices. Owner/Super Admin may set a manual display override when needed."
        >
          <CurrencySettingsPanel
            settings={settings}
            update={update}
            updateBool={updateBool}
            isOn={isOn}
          />
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
            <div className="sm:col-span-2">
              <CargoOptionsEditor
                value={settings.freight_cargo_options}
                onChange={(json) => update("freight_cargo_options", json)}
              />
            </div>
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
              hint="How often customers receive SMS/email on shipment changes. Every update includes notes and custom messages; milestones only sends status changes and one-click milestone chips."
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
          icon={Shield}
          title="Security"
          description="Passkeys, backup recovery codes, and password for your team account."
        >
          <SecuritySettings />
        </SettingsSection>

        <SettingsSection
          icon={Download}
          title="Install Admin App"
          description="Add the platform dashboard to your home screen for quick, app-like access."
        >
          <InstallAdminAppCard />
        </SettingsSection>

        <SettingsSection
          icon={Wrench}
          title="System"
          description="Maintenance mode locks the public site for customers while platform admins keep access."
        >
          <div className="space-y-4">
            <Toggle
              label="Maintenance mode"
              description="Redirects visitors and customer APIs to a branded maintenance page. Owner, Super Admin, and other signed-in platform admins bypass automatically."
              checked={isOn("maintenance_mode")}
              onChange={(v) => updateBool("maintenance_mode", v)}
            />
            <Field
              label="Maintenance message"
              hint="Shown on /maintenance and in the public site banner for admins browsing while mode is on."
            >
              <textarea
                className="platform-input min-h-[4rem] w-full resize-y"
                value={settings.maintenance_message}
                onChange={(e) => update("maintenance_message", e.target.value)}
              />
            </Field>
            {settings.maintenance_updated_at || settings.maintenance_enabled_at ? (
              <p className="text-xs text-[var(--platform-text-secondary)]">
                {isOn("maintenance_mode")
                  ? `Enabled ${formatPlatformDateTime(
                      settings.maintenance_enabled_at || settings.maintenance_updated_at
                    )}${
                      settings.maintenance_enabled_by
                        ? ` by ${settings.maintenance_enabled_by}`
                        : ""
                    }.`
                  : settings.maintenance_disabled_at
                    ? `Last disabled ${formatPlatformDateTime(settings.maintenance_disabled_at)}${
                        settings.maintenance_disabled_by
                          ? ` by ${settings.maintenance_disabled_by}`
                          : ""
                      }.`
                    : `Last updated ${formatPlatformDateTime(settings.maintenance_updated_at)}${
                        settings.maintenance_updated_by
                          ? ` by ${settings.maintenance_updated_by}`
                          : ""
                      }.`}
              </p>
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
