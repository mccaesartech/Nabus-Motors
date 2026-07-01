export const VEHICLE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Map vehicles by both UUID and slug so cart lines can resolve legacy slug keys. */
export function buildVehicleIdentifierMap<T extends { id: string; slug: string }>(
  vehicles: T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const vehicle of vehicles) {
    map.set(vehicle.id, vehicle);
    map.set(vehicle.slug, vehicle);
  }
  return map;
}

export function splitVehicleIdentifiers(identifiers: string[]) {
  const unique = [...new Set(identifiers.map((id) => id.trim()).filter(Boolean))];
  return {
    unique,
    ids: unique.filter((value) => VEHICLE_UUID_RE.test(value)),
    slugs: unique.filter((value) => !VEHICLE_UUID_RE.test(value)),
  };
}
