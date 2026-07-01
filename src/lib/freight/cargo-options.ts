export type CargoSizeOption = {
  value: string;
  label: string;
};

export type CargoTypeOption = {
  value: string;
  label: string;
  sizeLabel?: string;
  sizes?: CargoSizeOption[];
  detailLabel?: string;
  detailPlaceholder?: string;
  custom?: boolean;
};

export const DEFAULT_CARGO_TYPES: CargoTypeOption[] = [
  {
    value: "vehicle",
    label: "Vehicle",
    sizeLabel: "Vehicle type",
    sizes: [
      { value: "sedan", label: "Sedan" },
      { value: "suv", label: "SUV" },
      { value: "truck", label: "Truck" },
      { value: "motorcycle", label: "Motorcycle" },
    ],
    detailLabel: "Make / model (optional)",
    detailPlaceholder: "e.g. 2022 Toyota RAV4",
  },
  {
    value: "container",
    label: "Container",
    sizeLabel: "Container size",
    sizes: [
      { value: "20ft", label: "20ft" },
      { value: "40ft", label: "40ft" },
      { value: "40ft_hc", label: "40ft HC" },
    ],
  },
  {
    value: "general_cargo",
    label: "General cargo",
    sizeLabel: "Size category",
    sizes: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
    detailLabel: "Dimensions or weight estimate (optional)",
    detailPlaceholder: "e.g. 2×1×1 m or ~500 kg",
  },
  {
    value: "spare_parts",
    label: "Spare parts shipment",
    sizeLabel: "Estimated weight",
    sizes: [
      { value: "under_50kg", label: "Under 50 kg" },
      { value: "50_200kg", label: "50–200 kg" },
      { value: "over_200kg", label: "Over 200 kg" },
    ],
  },
  {
    value: "documents",
    label: "Documents only",
  },
  {
    value: "custom",
    label: "Custom",
    custom: true,
  },
];

export const DEFAULT_CARGO_OPTIONS_JSON = JSON.stringify(DEFAULT_CARGO_TYPES, null, 2);

function isCargoSizeOption(value: unknown): value is CargoSizeOption {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.value === "string" && typeof row.label === "string";
}

function isCargoTypeOption(value: unknown): value is CargoTypeOption {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.value !== "string" || typeof row.label !== "string") return false;
  if (row.sizes !== undefined) {
    if (!Array.isArray(row.sizes) || !row.sizes.every(isCargoSizeOption)) return false;
  }
  return true;
}

export function parseCargoOptions(raw: string | undefined | null): CargoTypeOption[] {
  if (!raw?.trim()) return DEFAULT_CARGO_TYPES;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CARGO_TYPES;
    if (!parsed.every(isCargoTypeOption)) return DEFAULT_CARGO_TYPES;
    return parsed;
  } catch {
    return DEFAULT_CARGO_TYPES;
  }
}

export function findCargoType(
  options: CargoTypeOption[],
  value: string
): CargoTypeOption | undefined {
  return options.find((opt) => opt.value === value);
}

export function findCargoSizeLabel(
  option: CargoTypeOption | undefined,
  sizeValue: string
): string {
  if (!option?.sizes?.length) return sizeValue;
  return option.sizes.find((s) => s.value === sizeValue)?.label ?? sizeValue;
}

export type CargoFieldValues = {
  cargoType: string;
  cargoSize: string;
  cargoDetail: string;
  customDescription: string;
};

export function buildCargoPayload(
  values: CargoFieldValues,
  options: CargoTypeOption[] = DEFAULT_CARGO_TYPES
): { cargoDescription: string; cargoSize: string | null } | { error: string } {
  const { cargoType, cargoSize, cargoDetail, customDescription } = values;
  const trimmedType = cargoType.trim();

  if (!trimmedType) {
    return { error: "Cargo description is required." };
  }

  const option = findCargoType(options, trimmedType);
  if (!option) {
    return { error: "Please select a valid cargo description." };
  }

  if (option.custom) {
    const description = customDescription.trim();
    if (!description) {
      return { error: "Please describe your custom cargo." };
    }
    const size = cargoDetail.trim();
    return {
      cargoDescription: description,
      cargoSize: size || null,
    };
  }

  if (option.value === "documents") {
    return {
      cargoDescription: option.label,
      cargoSize: null,
    };
  }

  const trimmedSize = cargoSize.trim();
  if (!trimmedSize) {
    return { error: "Please select a cargo size." };
  }

  const sizeLabel = findCargoSizeLabel(option, trimmedSize);
  const detail = cargoDetail.trim();

  return {
    cargoDescription: option.label,
    cargoSize: detail ? `${sizeLabel} — ${detail}` : sizeLabel,
  };
}

export function formatCargoDisplay(
  cargoDescription: string | null | undefined,
  cargoSize: string | null | undefined
): string | null {
  const description = cargoDescription?.trim();
  if (!description) return null;
  const size = cargoSize?.trim();
  return size ? `${description} (${size})` : description;
}
