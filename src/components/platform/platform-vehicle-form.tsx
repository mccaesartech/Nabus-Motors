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
import { omitEmptyOptionalVehicleFields } from "@/lib/admin/vehicle-columns";
import {
  buildVehiclePublishSummary,
  listingImageUrls,
  requirePrimaryVehicleImage,
  type VehiclePublishSummary,
} from "@/lib/admin/vehicle-publish-gates";
import { makes } from "@/lib/data/catalog-meta";
import {
  BASE_CURRENCY,
  convertBetweenCurrencies,
  formatAmount,
  formatUsdPrice,
  LISTING_PRICE_CURRENCIES,
  toStoredVehiclePrice,
} from "@/lib/currency";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { CategoryBadges } from "@/components/admin/category-badges";
import { VehicleAiChat } from "@/components/platform/vehicle-ai-chat";
import { VehicleImageUpload } from "@/components/platform/vehicle-image-upload";
import { VehicleColorField } from "@/components/shared/vehicle-color-field";
import { VehicleImageMismatchDialog } from "@/components/platform/vehicle-image-mismatch-dialog";
import { VehiclePublishConfirmDialog } from "@/components/platform/vehicle-publish-confirm-dialog";
import type { VehicleImageMatchIssue } from "@/lib/ai/vehicle-image-match-types";
import { adminErrorMessage, parseAdminResponse } from "@/lib/admin/client";

export type PlatformVehicle = VehicleInput & {
  id?: string;
  slug?: string;
};

type PlatformVehicleFormProps = {
  initial?: PlatformVehicle | null;
  onSave: (data: VehicleInput & { publishConfirmed?: boolean }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  /** Owner/super-admin saves that go live immediately. */
  requiresPublishConfirmation?: boolean;
  /** Shown on the primary submit button when publishing live. */
  publishButtonLabel?: string;
};

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <label className="block text-sm font-medium text-[var(--platform-text)]">{label}</label>
      {children}
      {hint && (
        <div className="text-xs text-[var(--platform-text-secondary)]">{hint}</div>
      )}
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
  requiresPublishConfirmation = false,
  publishButtonLabel,
}: PlatformVehicleFormProps) {
  const { formatVehicleListPrice, settingsDefaultCurrency, currency } =
    usePlatformCurrency();
  const [form, setForm] = useState<VehicleInput>(() =>
    initial
      ? {
          make: initial.make,
          model: initial.model,
          year: initial.year,
          trim: initial.trim ?? "",
          price: initial.price,
          price_currency:
            initial.price_currency || settingsDefaultCurrency || "GHS",
          mileage: initial.mileage,
          fuel_type: initial.fuel_type,
          transmission: initial.transmission,
          condition: initial.condition,
          body_type: initial.body_type,
          location: initial.location,
          engine_size: initial.engine_size ?? "",
          color: initial.color ?? "",
          vin: initial.vin ?? "",
          seating_capacity: initial.seating_capacity ?? undefined,
          drivetrain: initial.drivetrain ?? "",
          horsepower: initial.horsepower ?? "",
          range: initial.range ?? "",
          specs: initial.specs ?? [],
          description: initial.description ?? "",
          featured: initial.featured ?? false,
          status: initial.status ?? "available",
          images: initial.images ?? [],
          gallery: galleryFromInput(initial.gallery, initial.images),
          trust_badges: initial.trust_badges ?? { ...DEFAULT_TRUST_BADGES },
          inspection_summary: initial.inspection_summary ?? "",
          warranty_notes: initial.warranty_notes ?? "",
          walkaround_video_url: initial.walkaround_video_url ?? undefined,
          country_of_origin: initial.country_of_origin ?? "",
          financing_available: initial.financing_available ?? false,
          shipment_available: initial.shipment_available ?? false,
          customs_clearing_available: initial.customs_clearing_available ?? false,
          available_locally: initial.available_locally ?? false,
        }
      : emptyVehicleForm(settingsDefaultCurrency || currency || "GHS")
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
  const [verifyingImages, setVerifyingImages] = useState(false);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [mismatchSummary, setMismatchSummary] = useState("");
  const [mismatchIssues, setMismatchIssues] = useState<VehicleImageMatchIssue[]>([]);
  const [mismatchAllowManualConfirm, setMismatchAllowManualConfirm] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishSummary, setPublishSummary] = useState<VehiclePublishSummary | null>(null);
  const [pendingSavePayload, setPendingSavePayload] = useState<VehicleInput | null>(null);
  const [, setImagesAcknowledged] = useState(false);
  const imagesAcknowledgedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const totalPhotos = (primaryImageUrl ? 1 : 0) + additionalImages.length;
  const submitBusy = Boolean(saving || verifyingImages);

  function markImagesAcknowledged(value: boolean) {
    imagesAcknowledgedRef.current = value;
    setImagesAcknowledged(value);
  }

  function syncGalleryFromImages(primary: string, additional: string[]) {
    const nextGallery = primaryAndAdditionalToGallery(primary, additional);
    setGallery(nextGallery);
    return nextGallery;
  }

  function updatePrimaryImage(urls: string[]) {
    const nextPrimary = urls[0] ?? "";
    setPrimaryImageUrl(nextPrimary);
    markImagesAcknowledged(false);
    syncGalleryFromImages(nextPrimary, additionalImages);
  }

  function updateAdditionalImages(urls: string[]) {
    setAdditionalImages(urls);
    markImagesAcknowledged(false);
    syncGalleryFromImages(primaryImageUrl, urls);
  }

  function updateTrustBadge(key: keyof VehicleTrustBadges, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      trust_badges: { ...(prev.trust_badges ?? DEFAULT_TRUST_BADGES), [key]: checked },
    }));
  }

  function update<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    if (
      key === "make" ||
      key === "model" ||
      key === "year" ||
      key === "color" ||
      key === "body_type"
    ) {
      markImagesAcknowledged(false);
    }
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "available_locally" && value === true) {
        next.shipment_available = false;
      }
      if (key === "shipment_available" && value === true) {
        next.available_locally = false;
      }
      return next;
    });
  }

  function setPriceCurrency(nextCurrency: string) {
    setForm((prev) => {
      const from = prev.price_currency || settingsDefaultCurrency || "GHS";
      const to = nextCurrency.toUpperCase();
      if (from === to) {
        return { ...prev, price_currency: to };
      }
      const converted =
        prev.price > 0
          ? Math.round(convertBetweenCurrencies(prev.price, from, to))
          : prev.price;
      return { ...prev, price_currency: to, price: converted };
    });
  }

  function buildSyncedPayload(): VehicleInput {
    const synced = syncVehicleImagesFromPrimaryAndAdditional(
      primaryImageUrl,
      additionalImages
    );
    return omitEmptyOptionalVehicleFields({
      ...form,
      primary_image_url: synced.primary_image_url,
      additional_images: synced.additional_images,
      gallery: synced.gallery,
      images: synced.images,
    });
  }

  async function verifyImagesForPayload(payload: VehicleInput): Promise<{
    blocked: boolean;
    manualReviewRequired: boolean;
    summary: string;
    issues: VehicleImageMatchIssue[];
  }> {
    const imageError = requirePrimaryVehicleImage(payload);
    if (imageError) {
      return {
        blocked: true,
        manualReviewRequired: false,
        summary: imageError,
        issues: [
          {
            url: "",
            status: "no_vehicle",
            reason: imageError,
          },
        ],
      };
    }

    const res = await fetch("/api/admin/vehicles/verify-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        images: listingImageUrls(payload).slice(0, 3),
        vehicle: {
          make: payload.make,
          model: payload.model,
          year: payload.year,
          color: payload.color,
          body_type: payload.body_type,
        },
      }),
    });
    const json = await parseAdminResponse(res);
    if (!res.ok || !json.ok) {
      throw new Error(adminErrorMessage(json, "Could not verify listing photos."));
    }

    return {
      blocked: Boolean(json.blocked),
      manualReviewRequired: Boolean(json.manualReviewRequired),
      summary: String(json.summary ?? "Photo review completed."),
      issues: Array.isArray(json.issues) ? (json.issues as VehicleImageMatchIssue[]) : [],
    };
  }

  async function commitSave(payload: VehicleInput, publishConfirmed: boolean) {
    await onSave({
      ...payload,
      ...(publishConfirmed ? { publishConfirmed: true } : {}),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitBusy) return;
    setError("");

    const payload = buildSyncedPayload();
    const imageError = requirePrimaryVehicleImage(payload);
    if (imageError) {
      setMismatchSummary(imageError);
      setMismatchIssues([
        {
          url: "",
          status: "no_vehicle",
          reason: imageError,
        },
      ]);
      setMismatchAllowManualConfirm(false);
      setMismatchOpen(true);
      return;
    }

    setVerifyingImages(true);
    try {
      if (!imagesAcknowledgedRef.current) {
        const review = await verifyImagesForPayload(payload);
        if (review.blocked || review.manualReviewRequired) {
          setMismatchSummary(review.summary);
          setMismatchIssues(review.issues);
          setMismatchAllowManualConfirm(!review.blocked && review.manualReviewRequired);
          setMismatchOpen(true);
          return;
        }
      }

      setPendingSavePayload(payload);
      if (requiresPublishConfirmation) {
        setPublishSummary(buildVehiclePublishSummary(payload));
        setPublishConfirmOpen(true);
        return;
      }

      await commitSave(payload, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle.");
    } finally {
      setVerifyingImages(false);
    }
  }

  function rejectFlaggedImages() {
    const flagged = new Set(
      mismatchIssues
        .filter(
          (issue) =>
            issue.status === "mismatch" ||
            issue.status === "no_vehicle" ||
            issue.status === "uncertain"
        )
        .map((issue) => issue.url)
        .filter(Boolean)
    );

    if (flagged.size === 0) {
      setPrimaryImageUrl("");
      setAdditionalImages([]);
      syncGalleryFromImages("", []);
      markImagesAcknowledged(false);
      setError("Add photos of the actual vehicle, then try again.");
      return;
    }

    const nextPrimary = primaryImageUrl && flagged.has(primaryImageUrl) ? "" : primaryImageUrl;
    const nextAdditional = additionalImages.filter((url) => !flagged.has(url));
    setPrimaryImageUrl(nextPrimary);
    setAdditionalImages(nextAdditional);
    syncGalleryFromImages(nextPrimary, nextAdditional);
    markImagesAcknowledged(false);
    setError("Flagged photos were removed. Upload matching photos of this vehicle, then submit again.");
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

  const primarySubmitLabel = submitBusy
    ? verifyingImages
      ? "Checking photos…"
      : "Saving…"
    : publishButtonLabel
      ? publishButtonLabel
      : requiresPublishConfirmation
        ? initial?.id
          ? "Review & publish changes"
          : "Review & publish"
        : initial?.id
          ? "Save changes"
          : "Submit for approval";

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
            <VehicleColorField
              value={form.color ?? ""}
              onChange={(color) => update("color", color)}
              primaryImageUrl={form.primary_image_url || form.images?.[0]}
              selectClassName="platform-select w-full"
              inputClassName="platform-input"
            />
            <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
              Pick a named color from the list, or choose Custom to type your own.
              Match the color to the car in the primary photo.
            </p>
          </Field>
          <Field label="VIN / Stock #">
            <input
              value={form.vin}
              onChange={(e) => update("vin", e.target.value)}
              className="platform-input"
              placeholder="Vehicle identification number"
            />
          </Field>
          <Field
            label="Seating capacity"
            hint="Shown as “Seating” on the public vehicle page"
          >
            <input
              type="number"
              min={1}
              max={99}
              value={form.seating_capacity ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  update("seating_capacity", null);
                  return;
                }
                const n = Number(raw);
                update(
                  "seating_capacity",
                  Number.isFinite(n) && n > 0 ? Math.round(n) : null
                );
              }}
              className="platform-input"
              placeholder="e.g. 5"
            />
          </Field>
          <Field label="Drivetrain">
            <input
              value={form.drivetrain ?? ""}
              onChange={(e) => update("drivetrain", e.target.value)}
              className="platform-input"
              placeholder="e.g. AWD, FWD, RWD, 4WD"
              list="platform-drivetrains"
            />
            <datalist id="platform-drivetrains">
              <option value="FWD" />
              <option value="RWD" />
              <option value="AWD" />
              <option value="4WD" />
            </datalist>
          </Field>
          <Field label="Horsepower">
            <input
              value={form.horsepower ?? ""}
              onChange={(e) => update("horsepower", e.target.value)}
              className="platform-input"
              placeholder="e.g. 211 hp"
            />
          </Field>
          <Field
            label="Range"
            hint="For EVs / plug-in hybrids — leave blank if not applicable"
          >
            <input
              value={form.range ?? ""}
              onChange={(e) => update("range", e.target.value)}
              className="platform-input"
              placeholder="e.g. 450 km CLTC"
            />
          </Field>
        </div>
      </Section>

      <Section title="Pricing & status">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="List price *"
            hint="Enter the amount in the listing currency below. This does not change the public site currency for visitors."
            className="sm:col-span-2 lg:col-span-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                type="number"
                min={0}
                value={form.price || ""}
                onChange={(e) => update("price", Number(e.target.value))}
                required
                className="platform-input min-w-0 flex-1"
              />
              <select
                value={form.price_currency || settingsDefaultCurrency || "GHS"}
                onChange={(e) => setPriceCurrency(e.target.value)}
                className="platform-select w-full sm:w-36"
                aria-label="Listing price currency"
              >
                {LISTING_PRICE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            {form.price > 0 &&
              (() => {
                const listingCurrency =
                  form.price_currency || settingsDefaultCurrency || "GHS";
                const stored = toStoredVehiclePrice(form.price, listingCurrency);
                return (
                  <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                    Listing {formatAmount(form.price, listingCurrency)}
                    {listingCurrency !== BASE_CURRENCY && (
                      <>
                        {" "}
                        · stores as ≈ {formatAmount(stored.price, BASE_CURRENCY)}
                      </>
                    )}
                    {currency !== listingCurrency && (
                      <>
                        {" "}
                        · dashboard ≈{" "}
                        {formatVehicleListPrice({
                          price: stored.price,
                          priceCurrency: listingCurrency,
                          listedPrice: form.price,
                        })}
                      </>
                    )}
                    <span className="text-[var(--platform-text-secondary)]/70">
                      {" "}
                      · {formatUsdPrice(stored.price, "USD")} ·{" "}
                      {formatUsdPrice(stored.price, "EUR")}
                    </span>
                  </p>
                );
              })()}
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
            hint="When enabled, interested customers are emailed that this vehicle is in Ghana and can be bought without shipping. Turning this on clears “Shipment available”. Change Status to sold or pre-order to remove from public inventory."
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
        <Field
          label="Inspection summary"
          className="mt-4"
          hint={
            <div className="space-y-1.5">
              <p>
                Shown under Trust &amp; Inspection on the vehicle page. Write a clear,
                buyer-facing summary of the inspection — not just “OK.” Cover what was
                checked and the outcome (pass / minor issues / needs attention).
              </p>
              <p className="font-medium text-[var(--platform-text)]">Include when known:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Exterior — paint, body panels, glass, lights, dents/chips/scratches</li>
                <li>Interior — seats, trim, odors, controls, AC/heat</li>
                <li>Mechanical — engine/motor, transmission/drive, fluids, leaks, battery (EV/hybrid)</li>
                <li>Tires &amp; brakes — tread, wear, pads/rotors, spare</li>
                <li>Electronics — infotainment, cameras, sensors, warning lights</li>
                <li>Issues found — list defects honestly; note what was repaired or deferred</li>
                <li>Overall result — e.g. “Passed multi-point inspection” or “Passed with notes”</li>
              </ul>
            </div>
          }
        >
          <textarea
            value={form.inspection_summary ?? ""}
            onChange={(e) => update("inspection_summary", e.target.value)}
            rows={6}
            className="platform-textarea min-h-[8rem]"
            placeholder="e.g. Passed multi-point inspection with notes. Exterior: clean paint, minor stone chips on front bumper; Interior: clean, AC cold; Mechanical: no leaks, battery health good; Tires & brakes: even tread, pads ~60%; Electronics: all systems normal, no warning lights. Ready for sale."
          />
        </Field>
        <Field
          label="Warranty notes"
          className="mt-4"
          hint="What coverage the buyer gets. Leave blank to use the standard text for this vehicle's condition (New / CPO / Used)."
        >
          <textarea
            value={form.warranty_notes ?? ""}
            onChange={(e) => update("warranty_notes", e.target.value)}
            rows={3}
            className="platform-textarea min-h-[5rem]"
            placeholder="e.g. Remaining manufacturer warranty through Dec 2027 or 100,000 km. Optional 12-month extended cover available."
          />
        </Field>
        <Field
          label="Walkaround video URL"
          className="mt-4"
          hint="YouTube, Vimeo, or direct MP4 link — shown on the vehicle detail page when set"
        >
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
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
                  checked={Boolean(form.financing_available)}
                  onChange={(e) => update("financing_available", e.target.checked)}
                  className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
                />
                Financing available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.shipment_available)}
                  onChange={(e) => update("shipment_available", e.target.checked)}
                  className="size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
                />
                Shipment available
              </label>
              <p className="text-xs text-[var(--platform-text-secondary)]">
                Cannot combine with “Available locally”.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.customs_clearing_available)}
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
          Main photo shown on inventory cards and as the hero on the vehicle detail page. Photos
          must show this vehicle — mismatched or empty submissions are blocked until corrected.
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
          hint="Short sales pitch shown on the vehicle page. Mention standout features, condition, and why it's a good buy. Shift+Enter for a new line · Enter to save."
        >
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            onKeyDown={handleDescriptionKeyDown}
            rows={5}
            className="platform-textarea"
            placeholder="e.g. Well-maintained low-mileage Atto 3 with panoramic roof and full service history. Ready for local delivery."
          />
        </Field>
      </Section>

      {error && (
        <p className="rounded-lg border border-[var(--platform-error)]/30 bg-[rgba(220,38,38,0.06)] px-4 py-3 text-sm text-[var(--platform-error)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="submit" disabled={submitBusy} className="platform-btn-primary">
          {primarySubmitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitBusy}
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
            markImagesAcknowledged(false);
          }}
          onApplyGallery={(nextGallery) => {
            setGallery(nextGallery);
            const { primaryImageUrl: nextPrimary, additionalImages: nextAdditional } =
              primaryAndAdditionalFromVehicle({ gallery: nextGallery });
            setPrimaryImageUrl(nextPrimary);
            setAdditionalImages(nextAdditional);
            markImagesAcknowledged(false);
          }}
        />
      </div>

      <VehicleImageMismatchDialog
        open={mismatchOpen}
        onOpenChange={setMismatchOpen}
        summary={mismatchSummary}
        issues={mismatchIssues}
        allowManualConfirm={mismatchAllowManualConfirm}
        onRejectImages={rejectFlaggedImages}
        onCorrect={() => {
          setError(
            "Correct the listing details or replace the flagged photos, then submit again."
          );
        }}
        onManualConfirm={() => {
          markImagesAcknowledged(true);
          setError("");
          formRef.current?.requestSubmit();
        }}
      />

      {publishSummary ? (
        <VehiclePublishConfirmDialog
          open={publishConfirmOpen}
          onOpenChange={setPublishConfirmOpen}
          summary={publishSummary}
          mode="publish"
          onConfirm={async () => {
            if (!pendingSavePayload) return;
            try {
              await commitSave(pendingSavePayload, true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save vehicle.");
              throw err;
            }
          }}
        />
      ) : null}
    </div>
  );
}
