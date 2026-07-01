"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_CARGO_TYPES,
  findCargoType,
  parseCargoOptions,
  type CargoFieldValues,
  type CargoTypeOption,
} from "@/lib/freight/cargo-options";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export type CargoDescriptionFieldsProps = {
  idPrefix: string;
  values: CargoFieldValues;
  onChange: (values: CargoFieldValues) => void;
  options?: CargoTypeOption[];
};

export function useCargoDescriptionFields(): {
  values: CargoFieldValues;
  setValues: React.Dispatch<React.SetStateAction<CargoFieldValues>>;
  resetCargoFields: () => void;
  options: CargoTypeOption[];
  optionsLoading: boolean;
} {
  const [values, setValues] = useState<CargoFieldValues>({
    cargoType: "",
    cargoSize: "",
    cargoDetail: "",
    customDescription: "",
  });
  const [options, setOptions] = useState<CargoTypeOption[]>(DEFAULT_CARGO_TYPES);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/public")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const raw = json?.settings?.freight_cargo_options as string | undefined;
        setOptions(parseCargoOptions(raw));
      })
      .catch(() => {
        if (!cancelled) setOptions(DEFAULT_CARGO_TYPES);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetCargoFields() {
    setValues({
      cargoType: "",
      cargoSize: "",
      cargoDetail: "",
      customDescription: "",
    });
  }

  return { values, setValues, resetCargoFields, options, optionsLoading };
}

export function CargoDescriptionFields({
  idPrefix,
  values,
  onChange,
  options = DEFAULT_CARGO_TYPES,
}: CargoDescriptionFieldsProps) {
  const selected = findCargoType(options, values.cargoType);
  const isCustom = Boolean(selected?.custom);
  const isDocuments = selected?.value === "documents";
  const hasSizeSelect = Boolean(selected?.sizes?.length);

  function patch(partial: Partial<CargoFieldValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cargo-type`}>Cargo description *</Label>
        <select
          id={`${idPrefix}-cargo-type`}
          value={values.cargoType}
          onChange={(e) =>
            patch({
              cargoType: e.target.value,
              cargoSize: "",
              cargoDetail: "",
              customDescription: "",
            })
          }
          className={selectClassName}
          required
        >
          <option value="">Select cargo type…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isCustom && (
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-cargo-custom`}>Describe your cargo *</Label>
            <Input
              id={`${idPrefix}-cargo-custom`}
              value={values.customDescription}
              onChange={(e) => patch({ customDescription: e.target.value })}
              placeholder="e.g. Industrial machinery, furniture set"
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-cargo-custom-size`}>Size / dimensions</Label>
            <Input
              id={`${idPrefix}-cargo-custom-size`}
              value={values.cargoDetail}
              onChange={(e) => patch({ cargoDetail: e.target.value })}
              placeholder="e.g. 3×2×2 m, ~800 kg"
            />
          </div>
        </>
      )}

      {!isCustom && selected && !isDocuments && hasSizeSelect && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-cargo-size`}>{selected.sizeLabel ?? "Size"} *</Label>
          <select
            id={`${idPrefix}-cargo-size`}
            value={values.cargoSize}
            onChange={(e) => patch({ cargoSize: e.target.value })}
            className={selectClassName}
            required
          >
            <option value="">Select size…</option>
            {selected.sizes!.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isCustom && selected?.detailLabel && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-cargo-detail`}>{selected.detailLabel}</Label>
          <Input
            id={`${idPrefix}-cargo-detail`}
            value={values.cargoDetail}
            onChange={(e) => patch({ cargoDetail: e.target.value })}
            placeholder={selected.detailPlaceholder}
          />
        </div>
      )}
    </>
  );
}
