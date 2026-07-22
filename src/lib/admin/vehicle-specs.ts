import type { VehicleSpec } from "@/lib/types";

/** Spec labels written to `vehicles.specs` and shown on the public detail page. */
export const VEHICLE_SPEC_LABELS = {
  drivetrain: "Drivetrain",
  horsepower: "Horsepower",
  seating: "Seating",
  range: "Range",
} as const;

const KNOWN_SPEC_LABELS = new Set<string>(Object.values(VEHICLE_SPEC_LABELS));

export type VehicleSpecFormFields = {
  seating_capacity?: number | null;
  drivetrain?: string | null;
  horsepower?: string | null;
  range?: string | null;
  /** Existing/custom specs to preserve (unknown labels kept; known labels overridden). */
  specs?: VehicleSpec[] | null;
};

export function parseSeatingCapacity(value: string | null | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const match = value.match(/(\d+)/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function formatSeatingSpecValue(capacity: number): string {
  return `${capacity} passengers`;
}

export function formatHorsepowerSpecValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/hp/i.test(trimmed)) return trimmed;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed} hp`;
  return trimmed;
}

export function getSpecValue(
  specs: VehicleSpec[] | null | undefined,
  label: string
): string | undefined {
  if (!specs?.length) return undefined;
  const found = specs.find((s) => s.label.toLowerCase() === label.toLowerCase());
  const value = found?.value?.trim();
  return value || undefined;
}

/** Pull admin form fields from a DB/public specs array. */
export function extractSpecFormFields(
  specs: VehicleSpec[] | null | undefined
): Pick<
  VehicleSpecFormFields,
  "seating_capacity" | "drivetrain" | "horsepower" | "range"
> {
  const seatingRaw = getSpecValue(specs, VEHICLE_SPEC_LABELS.seating);
  return {
    seating_capacity: seatingRaw ? parseSeatingCapacity(seatingRaw) : undefined,
    drivetrain: getSpecValue(specs, VEHICLE_SPEC_LABELS.drivetrain) ?? "",
    horsepower: getSpecValue(specs, VEHICLE_SPEC_LABELS.horsepower) ?? "",
    range: getSpecValue(specs, VEHICLE_SPEC_LABELS.range) ?? "",
  };
}

/**
 * Build the JSONB `specs` payload from admin form fields.
 * Known labels are replaced; any custom labels from `specs` are preserved.
 */
export function buildVehicleSpecs(input: VehicleSpecFormFields): VehicleSpec[] {
  const extras = (input.specs ?? []).filter(
    (s) => s?.label && !KNOWN_SPEC_LABELS.has(s.label) && String(s.value ?? "").trim()
  );

  const result: VehicleSpec[] = [];

  const drivetrain = input.drivetrain?.trim();
  if (drivetrain) {
    result.push({ label: VEHICLE_SPEC_LABELS.drivetrain, value: drivetrain });
  }

  const horsepower = formatHorsepowerSpecValue(input.horsepower ?? "");
  if (horsepower) {
    result.push({ label: VEHICLE_SPEC_LABELS.horsepower, value: horsepower });
  }

  const seats = input.seating_capacity;
  if (seats != null && Number.isFinite(Number(seats)) && Number(seats) > 0) {
    result.push({
      label: VEHICLE_SPEC_LABELS.seating,
      value: formatSeatingSpecValue(Math.round(Number(seats))),
    });
  }

  const range = input.range?.trim();
  if (range) {
    result.push({ label: VEHICLE_SPEC_LABELS.range, value: range });
  }

  return [...result, ...extras.map((s) => ({ label: s.label, value: String(s.value).trim() }))];
}

/** True when the request body includes any specs-related form field. */
export function bodyHasSpecFormFields(body: Record<string, unknown>): boolean {
  return (
    body.seating_capacity !== undefined ||
    body.drivetrain !== undefined ||
    body.horsepower !== undefined ||
    body.range !== undefined ||
    body.specs !== undefined
  );
}
