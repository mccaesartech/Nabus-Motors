"use client";

import { useRef, useState } from "react";
import {
  BODY_TYPES,
  CONDITIONS,
  COUNTRY_OF_ORIGIN_OPTIONS,
  emptyVehicleForm,
  FUEL_TYPES,
  galleryFromInput,
  primaryAndAdditionalFromVehicle,
  syncVehicleImagesFromPrimaryAndAdditional,
  LOCATIONS,
  TRANSMISSIONS,
  VEHICLE_STATUSES,
  VEHICLE_STATUS_LABELS,
  type VehicleInput,
} from "@/lib/admin/vehicle-fields";
import {
  DEFAULT_TRUST_BADGES,
  TRUST_BADGE_KEYS,
  TRUST_BADGE_LABELS,
  type VehicleTrustBadges,
} from "@/lib/vehicles/trust-badges";
import type { VehicleGalleryData } from "@/lib/types";
import { EMPTY_VEHICLE_GALLERY } from "@/lib/types";
import { primaryAndAdditionalToGallery } from "@/lib/data/vehicle-images";
import { makes } from "@/lib/data/catalog-meta";
import { formatAdminCurrencyPreviews } from "@/lib/currency";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { CategoryBadges } from "@/components/admin/category-badges";
import { VehicleAiChat } from "@/components/platform/vehicle-ai-chat";
import { VehicleImageUpload } from "@/components/platform/vehicle-image-upload";

export type PlatformVehicle = VehicleInput & {
  id?: string;
  slug?: string;
};

type PlatformVehicleFormProps = {
  initial?: PlatformVehicle | null;
  onSave: (data: VehicleInput) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

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
    <div className={className ?? "space-y-1.5"}>
      <label className="block text-sm font-medium text-[var(--platform-text)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--platform-text-secondary)]">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="platform-form-section">
      <h2 className="platform-form-section-title">{title}</h2>
      {children}
    </section>
  );
}

export function PlatformVehicleForm({
  initial,
  onSave,
  onCancel,
  saving,
}: PlatformVehicleFormProps) {
  const { formatPrice } = usePlatformCurrency();
  const [form, setForm] = useState<VehicleInput>(() =>
    initial
      ? {
          make: initial.make,
          model: initial.model,
          year: initial.year,
          trim: initial.trim ?? "",
          price: initial.price,
          mileage: initial.mileage,
          fuel_type: initial.fuel_type,
          transmission: initial.transmission,
          condition: initial.condition,
          body_type: initial.body_type,
          location: initial.location,
          engine_size: initial.engine_size ?? "",
          color: initial.color ?? "",
          vin: initial.vin ?? "",
          description: initial.description ?? "",
          featured: initial.featured ?? false,
          status: initial.status ?? "available",
          images: initial.images ?? [],
          gallery: galleryFromInput(initial.gallery, initial.images),
          trust_badges: initial.trust_badges ?? { ...DEFAULT_TRUST_BADGES },
          inspection_summary: initial.inspection_summary ?? "",
          warranty_notes: initial.warranty_notes ?? "",
          walkaround_video_url: initial.walkaround_video_url ?? "",
          country_of_origin: initial.country_of_origin ?? "",
          financing_available: initial.financing_available ?? true,
          shipment_available: initial.shipment_available ?? true,
          customs_clearing_available: initial.customs_clearing_available ?? true,
          available_locally: initial.available_locally ?? false,
        }
      : emptyVehicleForm()
  );
  const initialImages = primaryAndAdditionalFromVehicle(
    initial ?? { gallery: EMPTY_VEHICLE_GALLERY, images: [] }
  );
  const [primaryImageUrl, setPrimaryImageUrl] = useState(initialImages.primaryImageUrl);
  const [additionalImages, setAdditionalImages] = useState(initialImages.additionalImages);
  const [gallery, setGallery] = useState<VehicleGalleryData>(() =>
    primaryAndAdditionalToGallery(
      initialImages.primaryImageUrl,
      initialImages.additionalImages
    )
  );
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const totalPhotos = (primaryImageUrl ? 1 : 0) + additionalImages.length;

  function syncGalleryFromImages(primary: string, additional: string[]) {
    const nextGallery = primaryAndAdditionalToGallery(primary, additional);
    setGallery(nextGallery);
    return nextGallery;
  }

  function updatePrimaryImage(urls: string[]) {
    const nextPrimary = urls[0] ?? "";
    setPrimaryImageUrl(nextPrimary);
    syncGalleryFromImages(nextPrimary, additionalImages);
  }

  function updateAdditionalImages(urls: string[]) {
    setAdditionalImages(urls);
    syncGalleryFromImages(primaryImageUrl, urls);
  }

  function updateTrustBadge(key: keyof VehicleTrustBadges, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      trust_badges: { ...(prev.trust_badges ?? DEFAULT_TRUST_BADGES), [key]: checked },
    }));
  }

  function update<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    try {
      const synced = syncVehicleImagesFromPrimaryAndAdditional(
        primaryImageUrl,
        additionalImages
      );
      await onSave({
        ...form,
        primary_image_url: synced.primary_image_url,
        additional_images: synced.additional_images,
        gallery: synced.gallery,
        images: synced.images,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle.");
    }
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.tagName === "TEXTAREA") return;
    if (el instanceof HTMLInputElement) {
      if (el.type === "url" || el.type === "checkbox" || el.type === "file") return;
    }
    e.preventDefault();
    formRef.current?.requestSubmit();
  }

  function handleDescriptionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="grid gap-6 pb-4 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start">
      <form
        ref={formRef}
        id="platform-vehicle-form"
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        className="space-y-5"
      >
      {initial?.id && (
        <div className="platform-form-section">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Listing categories
          </p>
          <div className="mt-2">
            <CategoryBadges
              variant="platform"
              vehicle={{
                make: form.make,
                model: String(form.model ?? ""),
                year: Number(form.year) || 0,
                body_type: String(form.body_type),
                transmission: String(form.transmission),
                fuel_type: String(form.fuel_type),
                featured: Boolean(form.featured),
                status: String(form.status ?? "available"),
              }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--platform-text-secondary)]">
            Categories update automatically from body type, fuel, transmission, and featured
            settings below.
          </p>
        </div>
      )}

      <Section title="Basic info">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Make *">
            <input
              list="platform-makes"
              value={form.make}
              onChange={(e) => update("make", e.target.value)}
              required
              className="platform-input"
              placeholder="e.g. BYD"
            />
            <datalist id="platform-makes">
              {makes.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Model *">
            <input
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              required
              className="platform-input"
              placeholder="e.g. Atto 3"
            />
          </Field>
          <Field label="Year *">
            <input
              type="number"
              min={1990}
              max={2030}
              value={form.year}
              onChange={(e) => update("year", Number(e.target.value))}
              required
              className="platform-input"
            />
          </Field>
          <Field label="Trim">
            <input
              value={form.trim}
              onChange={(e) => update("trim", e.target.value)}
              className="platform-input"
              placeholder="e.g. Premium"
            />
          </Field>
          <Field label="Location *">
            <select
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              className="platform-select w-full"
            >
              {LOCATIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          {initial?.slug && (
            <Field label="URL slug" hint="Auto-generated; shown on the public listing URL.">
              <input value={initial.slug} readOnly className="platform-input opacity-70" />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Specs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Body type">
            <select
              value={form.body_type}
              onChange={(e) => update("body_type", e.target.value)}
              className="platform-select w-full"
            >
              {BODY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Transmission">
            <select
              value={form.transmission}
              onChange={(e) => update("transmission", e.target.value)}
              className="platform-select w-full"
            >
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fuel type">
            <select
              value={form.fuel_type}
              onChange={(e) => update("fuel_type", e.target.value)}
              className="platform-select w-full"
            >
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Condition">
            <select
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              className="platform-select w-full"
            >
              {CONDITIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Engine">
            <input
              value={form.engine_size}
              onChange={(e) => update("engine_size", e.target.value)}
              className="platform-input"
              placeholder="e.g. 2.0L Turbo"
            />
          </Field>
          <Field label="Color">
            <input
              value={form.color}
              onChange={(e) => update("color", e.target.value)}
              className="platform-input"
              placeholder="e.g. Pearl White"
            />
          </Field>
          <Field label="VIN / Stock #">
            <input
              value={form.vin}
              onChange={(e) => update("vin", e.target.value)}
              className="platform-input"
              placeholder="Vehicle identification number"
            />
          </Field>
        </div>
      </Section>

      <Section title="Pricing & status">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="List price *">
            <input
              type="number"
              min={0}
              value={form.price || ""}
              onChange={(e) => update("price", Number(e.target.value))}
              required
              className="platform-input"
            />
            {form.price > 0 && (
              <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                ≈ {formatPrice(form.price)}
                <span className="text-[var(--platform-text-secondary)]/70">
                  {" "}
                  · {formatAdminCurrencyPreviews(form.price)}
                </span>
              </p>
            )}
          </Field>
          <Field label="Mileage (km) *">
            <input
              type="number"
              min={0}
              value={form.mileage || ""}
              onChange={(e) => update("mileage", Number(e.target.value))}
              required
              className="platform-input"
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="platform-select w-full"
              title="Vehicles stay listed after customer checkout until you change status here."
            >
              {VEHICLE_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {VEHICLE_STATUS_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            {form.status === "sold" && (
              <button
                type="button"
                onClick={() => update("status", "available")}
                title="Use when more stock of this model exists"
                className="mt-2 text-xs font-medium text-[var(--platform-success)] hover:underline"
              >
                Make available again
              </button>
            )}
            <p className="mt-1.5 text-xs text-[var(--platform-text-secondary)]">
              Customer purchases do not change status automatically. When you mark the last
              available unit sold, the listing moves to pre-order so more customers can
              request it. Multiple pre-orders per vehicle are allowed.
            </p>
          </Field>
          <Field
            label="Local availability"
            hint="When enabled, interested customers are emailed that this vehicle is in Ghana and can be bought without shipping. Turning off does not send notifications."
          >
            <label className="flex items-center gap-2.5 rounded-lg border border-[var(--platform-border)] px-3 py-2.5 text-sm text-[var(--platform-text)]">
              <input
                type="checkbox"
                checked={Boolean(form.available_locally)}
                onChange={(e) => update("available_locally", e.target.checked)}
                className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
              />
              <span>
                {form.available_locally
                  ? "Now available locally (without shipping)"
                  : "Not yet available locally"}
              </span>
            </label>
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2.5 text-sm text-[var(--platform-text)]">
          <input
            type="checkbox"
            checked={Boolean(form.featured)}
            onChange={(e) => update("featured", e.target.checked)}
            className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
          />
          Show on homepage as featured vehicle
        </label>
      </Section>

      <Section title="Trust & services">
        <p className="mb-4 text-sm text-[var(--platform-text-secondary)]">
          Trust badges appear on inventory cards and vehicle detail pages. Service flags power
          professional inventory filters.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {TRUST_BADGE_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-start gap-2.5 rounded-lg border border-[var(--platform-border)] px-3 py-2.5 text-sm text-[var(--platform-text)]"
            >
              <input
                type="checkbox"
                checked={Boolean(form.trust_badges?.[key])}
                onChange={(e) => updateTrustBadge(key, e.target.checked)}
                className="mt-0.5 size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
              />
              <span>{TRUST_BADGE_LABELS[key]}</span>
            </label>
          ))}
        </div>
        <Field label="Inspection summary" className="mt-4">
          <textarea
            value={form.inspection_summary ?? ""}
            onChange={(e) => update("inspection_summary", e.target.value)}
            rows={4}
            className="platform-textarea min-h-[6rem]"
            placeholder="Brief inspection notes shown on the vehicle detail page…"
          />
        </Field>
        <Field label="Warranty notes" className="mt-4">
          <textarea
            value={form.warranty_notes ?? ""}
            onChange={(e) => update("warranty_notes", e.target.value)}
            rows={3}
            className="platform-textarea min-h-[5rem]"
            placeholder="Optional warranty coverage notes — leave blank to use condition-based defaults"
          />
        </Field>
        <Field
          label="Walkaround video URL"
          className="mt-4"
          hint="YouTube, Vimeo, or direct MP4 link — shown on the vehicle detail page when set"
        >
          <input
            type="url"
            value={form.walkaround_video_url ?? ""}
            onChange={(e) => update("walkaround_video_url", e.target.value)}
            className="platform-input w-full"
            placeholder="https://youtube.com/watch?v=… or https://…/video.mp4"
          />
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Country of origin">
            <select
              value={form.country_of_origin ?? ""}
              onChange={(e) =>
                update("country_of_origin", e.target.value as VehicleInput["country_of_origin"])
              }
              className="platform-select w-full"
            >
              {COUNTRY_OF_ORIGIN_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Services available">
            <div className="space-y-2 rounded-lg border border-[var(--platform-border)] p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.financing_available !== false}
                  onChange={(e) => update("financing_available", e.target.checked)}
                  className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
                />
                Financing available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.shipment_available !== false}
                  onChange={(e) => update("shipment_available", e.target.checked)}
                  className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
                />
                Shipment available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.customs_clearing_available !== false}
                  onChange={(e) => update("customs_clearing_available", e.target.checked)}
                  className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
                />
                Customs clearing available
              </label>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Primary image">
        <p className="mb-4 text-sm text-[var(--platform-text-secondary)]">
          Main photo shown on inventory cards and as the hero on the vehicle detail page.
        </p>
        <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-4">
          <VehicleImageUpload
            label="Listing hero photo"
            hint="Upload one high-quality exterior shot. This stays separate from the gallery below."
            urls={primaryImageUrl ? [primaryImageUrl] : []}
            onUrlsChange={updatePrimaryImage}
            maxImages={1}
          />
        </div>
      </Section>

      <Section title="Additional images">
        <p className="mb-4 text-sm text-[var(--platform-text-secondary)]">
          Add as many extra photos as you want — interior, engine bay, wheels, and more. Use the
          arrow buttons on each thumbnail to reorder. You have{" "}
          <span className="font-medium text-[var(--platform-text)]">{totalPhotos}</span> photo
          {totalPhotos === 1 ? "" : "s"} total
          {!primaryImageUrl ? " — add a primary image above." : "."}
        </p>
        <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-4">
          <VehicleImageUpload
            label="Gallery photos"
            hint="Unlimited additional images. Upload files or paste URLs."
            urls={additionalImages}
            onUrlsChange={updateAdditionalImages}
            reorderable
          />
        </div>
      </Section>

      <Section title="Description">
        <Field
          label="Listing description"
          hint="Shift+Enter for new line · Enter to save"
        >
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            onKeyDown={handleDescriptionKeyDown}
            rows={5}
            className="platform-textarea"
            placeholder="Short description for the listing page"
          />
        </Field>
      </Section>

      {error && (
        <p className="rounded-lg border border-[var(--platform-error)]/30 bg-[rgba(220,38,38,0.06)] px-4 py-3 text-sm text-[var(--platform-error)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="submit" disabled={saving} className="platform-btn-primary">
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Add vehicle"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="platform-btn-ghost"
        >
          Cancel
        </button>
      </div>
      </form>

      <div className="lg:sticky lg:top-4">
        <VehicleAiChat
          form={form}
          gallery={gallery}
          slug={initial?.slug}
          onApplyFields={(fields) => {
            setForm((prev) => ({ ...prev, ...fields }));
          }}
          onApplyGallery={(nextGallery) => {
            setGallery(nextGallery);
            const { primaryImageUrl: nextPrimary, additionalImages: nextAdditional } =
              primaryAndAdditionalFromVehicle({ gallery: nextGallery });
            setPrimaryImageUrl(nextPrimary);
            setAdditionalImages(nextAdditional);
          }}
        />
      </div>
    </div>
  );
}
