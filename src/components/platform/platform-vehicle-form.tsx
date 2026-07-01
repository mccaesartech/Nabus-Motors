"use client";

import { useRef, useState } from "react";
import {
  BODY_TYPES,
  CONDITIONS,
  emptyVehicleForm,
  FUEL_TYPES,
  galleryFromInput,
  imagesFromGallery,
  LOCATIONS,
  TRANSMISSIONS,
  VEHICLE_STATUSES,
  VEHICLE_STATUS_LABELS,
  type VehicleInput,
} from "@/lib/admin/vehicle-fields";
import type { VehicleGalleryData, VehicleImageCategory } from "@/lib/types";
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

const GALLERY_CATEGORIES: {
  key: VehicleImageCategory;
  label: string;
  hint: string;
}[] = [
  {
    key: "exterior",
    label: "Exterior / Outlook",
    hint: "Main body shots used as the listing hero. Add at least 1 exterior photo.",
  },
  {
    key: "interior",
    label: "Interior",
    hint: "Add 2–4 interior photos buyers expect: cabin, seats, dashboard, steering wheel.",
  },
  {
    key: "engine",
    label: "Engine",
    hint: "Engine bay and mechanical details buyers want to verify.",
  },
  {
    key: "other",
    label: "Other",
    hint: "Optional extras — wheels, trunk, accessories, or additional angles.",
  },
];

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
        }
      : emptyVehicleForm()
  );
  const [gallery, setGallery] = useState<VehicleGalleryData>(() =>
    galleryFromInput(initial?.gallery, initial?.images)
  );
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const totalPhotos =
    gallery.exterior.length +
    gallery.interior.length +
    gallery.engine.length +
    gallery.other.length;

  function update<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGalleryCategory(key: VehicleImageCategory, urls: string[]) {
    setGallery((prev) => ({ ...prev, [key]: urls }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    try {
      const images = imagesFromGallery(gallery);
      await onSave({
        ...form,
        gallery,
        images,
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

      <Section title="Photos">
        <p className="mb-4 text-sm text-[var(--platform-text-secondary)]">
          Upload real photos of this vehicle for the best listing. Use the AI Editor
          panel to suggest stock placeholders, or drag and drop your own images below. You have{" "}
          <span className="font-medium text-[var(--platform-text)]">{totalPhotos}</span> photo
          {totalPhotos === 1 ? "" : "s"} uploaded
          {gallery.exterior.length === 0 ? " — add at least 1 exterior shot." : "."}
        </p>
        <div className="space-y-6">
          {GALLERY_CATEGORIES.map((category) => (
            <div
              key={category.key}
              className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-4"
            >
              <VehicleImageUpload
                label={category.label}
                hint={category.hint}
                urls={gallery[category.key]}
                onUrlsChange={(urls) => updateGalleryCategory(category.key, urls)}
              />
            </div>
          ))}
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
          }}
        />
      </div>
    </div>
  );
}
