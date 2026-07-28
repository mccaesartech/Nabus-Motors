"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BODY_TYPES,
  CONDITIONS,
  emptyVehicleForm,
  FUEL_TYPES,
  imagesToInput,
  LOCATIONS,
  parseImagesInput,
  TRANSMISSIONS,
  VEHICLE_STATUSES,
  VEHICLE_STATUS_LABELS,
  type VehicleInput,
} from "@/lib/admin/vehicle-fields";
import { makes } from "@/lib/data/catalog-meta";
import {
  BASE_CURRENCY,
  convertBetweenCurrencies,
  DEFAULT_DISPLAY_CURRENCY,
  formatAmount,
  formatUsdPrice,
  LISTING_PRICE_CURRENCIES,
  toStoredVehiclePrice,
} from "@/lib/currency";
import { isValidImageUrl } from "@/lib/data/vehicle-images";
import { CategoryBadges } from "@/components/admin/category-badges";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { VehicleColorField } from "@/components/shared/vehicle-color-field";

export type AdminVehicle = VehicleInput & {
  id?: string;
  slug?: string;
};

type VehicleFormProps = {
  initial?: AdminVehicle | null;
  onSave: (data: VehicleInput) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-white/90">{label}</Label>
      {children}
    </div>
  );
}

const inputClass =
  "border-white/20 bg-brand-charcoal/60 text-white placeholder:text-white/40";

const selectClass =
  "h-8 w-full rounded-lg border border-white/20 bg-brand-charcoal/60 px-2.5 text-sm text-white";

export function VehicleForm({ initial, onSave, onCancel, saving }: VehicleFormProps) {
  const [form, setForm] = useState<VehicleInput>(() =>
    initial
      ? {
          make: initial.make,
          model: initial.model,
          year: initial.year,
          trim: initial.trim ?? "",
          price: initial.price,
          price_currency: initial.price_currency || DEFAULT_DISPLAY_CURRENCY,
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
        }
      : emptyVehicleForm(DEFAULT_DISPLAY_CURRENCY)
  );
  const [imageText, setImageText] = useState(() => imagesToInput(initial?.images));
  const [error, setError] = useState("");
  const previewUrls = parseImagesInput(imageText).filter(isValidImageUrl);

  function update<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setPriceCurrency(nextCurrency: string) {
    setForm((prev) => {
      const from = prev.price_currency || DEFAULT_DISPLAY_CURRENCY;
      const to = nextCurrency.toUpperCase();
      if (from === to) return { ...prev, price_currency: to };
      const converted =
        prev.price > 0
          ? Math.round(convertBetweenCurrencies(prev.price, from, to))
          : prev.price;
      return { ...prev, price_currency: to, price: converted };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onSave({
        ...form,
        images: parseImagesInput(imageText),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {initial?.id && (
        <div className="rounded border border-white/10 bg-brand-charcoal/40 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">
            Current categories
          </p>
          <div className="mt-2">
            <CategoryBadges
              variant="admin"
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
          <p className="mt-2 text-xs text-white/50">
            Change body type, fuel, or transmission below to move this car between
            categories on the website.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Make *">
          <Input
            list="admin-makes"
            value={form.make}
            onChange={(e) => update("make", e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. BYD"
          />
          <datalist id="admin-makes">
            {makes.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Model *">
          <Input
            value={form.model}
            onChange={(e) => update("model", e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. Atto 3"
          />
        </Field>
        <Field label="Year *">
          <Input
            type="number"
            min={1990}
            max={2030}
            value={form.year}
            onChange={(e) => update("year", Number(e.target.value))}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Trim">
          <Input
            value={form.trim}
            onChange={(e) => update("trim", e.target.value)}
            className={inputClass}
            placeholder="e.g. Premium"
          />
        </Field>
        <Field label="List price *">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="number"
              min={0}
              value={form.price || ""}
              onChange={(e) => update("price", Number(e.target.value))}
              required
              className={inputClass}
            />
            <select
              value={form.price_currency || DEFAULT_DISPLAY_CURRENCY}
              onChange={(e) => setPriceCurrency(e.target.value)}
              className={selectClass + " sm:w-32"}
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
                form.price_currency || DEFAULT_DISPLAY_CURRENCY;
              const stored = toStoredVehiclePrice(form.price, listingCurrency);
              return (
                <p className="mt-1.5 text-xs text-white/50">
                  Listing {formatAmount(form.price, listingCurrency)}
                  {listingCurrency !== BASE_CURRENCY && (
                    <> · stores as ≈ {formatAmount(stored.price, BASE_CURRENCY)}</>
                  )}
                  <span className="text-white/35">
                    {" "}
                    · {formatUsdPrice(stored.price, "USD")} ·{" "}
                    {formatUsdPrice(stored.price, "EUR")}
                  </span>
                </p>
              );
            })()}
        </Field>
        <Field label="Mileage (km) *">
          <Input
            type="number"
            min={0}
            value={form.mileage || ""}
            onChange={(e) => update("mileage", Number(e.target.value))}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Body type">
          <select
            value={form.body_type}
            onChange={(e) => update("body_type", e.target.value)}
            className={selectClass}
          >
            {BODY_TYPES.map((t) => (
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
            className={selectClass}
          >
            {FUEL_TYPES.map((t) => (
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
            className={selectClass}
          >
            {TRANSMISSIONS.map((t) => (
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
            className={selectClass}
          >
            {CONDITIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className={selectClass}
          >
            {VEHICLE_STATUSES.map((t) => (
              <option key={t} value={t}>
                {VEHICLE_STATUS_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location *">
          <select
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className={selectClass}
          >
            {LOCATIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Engine">
          <Input
            value={form.engine_size}
            onChange={(e) => update("engine_size", e.target.value)}
            className={inputClass}
            placeholder="e.g. 2.0L Turbo"
          />
        </Field>
        <Field label="Color">
          <VehicleColorField
            value={form.color ?? ""}
            onChange={(color) => update("color", color)}
            primaryImageUrl={form.primary_image_url || form.images?.[0]}
            selectClassName={selectClass}
            inputClassName={inputClass}
          />
        </Field>
        <Field label="VIN">
          <Input
            value={form.vin}
            onChange={(e) => update("vin", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Seating capacity">
          <Input
            type="number"
            min={1}
            max={99}
            value={form.seating_capacity ?? ""}
            onChange={(e) =>
              update(
                "seating_capacity",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            className={inputClass}
            placeholder="e.g. 5"
          />
        </Field>
        <Field label="Drivetrain">
          <Input
            value={form.drivetrain ?? ""}
            onChange={(e) => update("drivetrain", e.target.value)}
            className={inputClass}
            placeholder="e.g. AWD"
          />
        </Field>
        <Field label="Horsepower">
          <Input
            value={form.horsepower ?? ""}
            onChange={(e) => update("horsepower", e.target.value)}
            className={inputClass}
            placeholder="e.g. 211 hp"
          />
        </Field>
        <Field label="Range">
          <Input
            value={form.range ?? ""}
            onChange={(e) => update("range", e.target.value)}
            className={inputClass}
            placeholder="e.g. 450 km CLTC"
          />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Short description for the listing page"
        />
      </Field>

      <Field label="Photo URLs (one per line)">
        <Textarea
          value={imageText}
          onChange={(e) => setImageText(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="https://images.pexels.com/..."
        />
        <p className="text-xs text-white/50">
          Leave empty to use an automatic car photo on the website.
        </p>
        {previewUrls.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {previewUrls.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="relative size-24 overflow-hidden rounded border border-white/20 bg-brand-charcoal/60"
              >
                <SafeVehicleImage
                  src={url}
                  alt={`Preview ${i + 1}`}
                  fill={false}
                  width={96}
                  height={96}
                  className="size-24"
                />
              </div>
            ))}
          </div>
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm text-white/90">
        <input
          type="checkbox"
          checked={Boolean(form.featured)}
          onChange={(e) => update("featured", e.target.checked)}
          className="size-4 rounded border-white/30"
        />
        Show on homepage as featured vehicle
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Add vehicle"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
