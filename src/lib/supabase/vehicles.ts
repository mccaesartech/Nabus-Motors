import { unstable_cache } from "next/cache";
import { cache as reactCache } from "react";
import type { Vehicle, VehicleSpec, HistoryEvent, VehicleAvailabilityStatus, VehicleGalleryData, CountryOfOrigin } from "@/lib/types";
import { parseTrustBadges } from "@/lib/vehicles/trust-badges";
import { vehicles as mockVehicles } from "@/lib/data/vehicles";
import { resolveVehicleGallery, flattenGallery, resolvePrimaryImageUrl, resolveAdditionalImages } from "@/lib/data/vehicle-images";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  isPendingNewListing,
  isPubliclyListed,
} from "@/lib/admin/vehicle-pending-changes";
import type { CartVehicleCatalogState } from "@/lib/parts/cart-types";
import { PUBLIC_VEHICLE_STATUSES } from "@/lib/vehicles/availability";
import { isLocallyAvailableForBanner } from "@/lib/vehicles/local-availability";
import { notDeletedFilter } from "@/lib/platform/trash-types";
import { splitVehicleIdentifiers } from "@/lib/vehicles/identifier-map";
import { allowDemoData } from "@/lib/runtime-mode";

const FETCH_TIMEOUT_MS = 5000;

function developmentVehicleFallback(): Vehicle[] {
  if (!allowDemoData()) return [];
  return mockVehicles.filter(
    (vehicle) =>
      !vehicle.status ||
      vehicle.status === "available" ||
      vehicle.status === "pre_order"
  );
}

/** Cache tag for on-demand invalidation after admin inventory changes. */
export const PUBLIC_VEHICLES_CACHE_TAG = "public-vehicles";

/** Time-based revalidation for public vehicle listings (seconds). */
export const PUBLIC_VEHICLES_REVALIDATE_SECONDS = 120;

/** After first pending_changes schema error, skip the expensive OR filter. */
let pendingChangesColumnAvailable: boolean | null = null;

/** After first primary_image_url schema error, use legacy listing select. */
let vehicleImageColumnsAvailable: boolean | null = null;

/** After first trust/filter column schema error, use legacy listing select. */
let vehicleTrustColumnsAvailable: boolean | null = null;

function isVehicleTrustColumnsSchemaError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("trust_badges") ||
    lower.includes("country_of_origin") ||
    lower.includes("financing_available") ||
    lower.includes("shipment_available") ||
    lower.includes("customs_clearing_available") ||
    lower.includes("available_locally") ||
    lower.includes("local_availability_at")
  );
}

function isVehicleImageColumnsSchemaError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("primary_image_url") ||
    lower.includes("additional_images")
  );
}

/** Same approval filter as public RLS and fetchAllVehicles. */
export const PUBLIC_LISTING_APPROVAL_OR =
  "approval_status.eq.approved,and(approval_status.eq.pending_approval,pending_changes.not.is.null),and(approval_status.eq.rejected,pending_changes.not.is.null)";

const PUBLIC_LISTING_APPROVAL_APPROVED_ONLY = "approval_status.eq.approved";

function isPendingChangesSchemaError(message?: string | null): boolean {
  return Boolean(message?.includes("pending_changes"));
}

type PublicListingResult = {
  data: unknown;
  error: { message: string } | null;
};

/** Run a public listing query; fall back when pending_changes column is not migrated yet. */
async function runPublicListingQuery(
  build: (approvalOr: string, listingSelect: string) => PromiseLike<PublicListingResult>
): Promise<PublicListingResult> {
  const approvalOr =
    pendingChangesColumnAvailable === false
      ? PUBLIC_LISTING_APPROVAL_APPROVED_ONLY
      : PUBLIC_LISTING_APPROVAL_OR;
  const listingSelect = publicListingSelect();

  const primary = await build(approvalOr, listingSelect);
  if (!primary.error) {
    if (pendingChangesColumnAvailable === null) {
      pendingChangesColumnAvailable = true;
    }
    if (vehicleImageColumnsAvailable === null) {
      vehicleImageColumnsAvailable = true;
    }
    return primary;
  }

  if (isVehicleImageColumnsSchemaError(primary.error.message)) {
    vehicleImageColumnsAvailable = false;
    if (listingSelect !== PUBLIC_LISTING_SELECT_LEGACY) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[vehicles] primary_image_url/additional_images columns missing — using legacy listing select"
        );
      }
      const fallback = await build(approvalOr, PUBLIC_LISTING_SELECT_LEGACY);
      if (!fallback.error) return fallback;
    }
  }

  if (isVehicleTrustColumnsSchemaError(primary.error.message)) {
    vehicleTrustColumnsAvailable = false;
    const trustFallbackSelect =
      vehicleImageColumnsAvailable === false
        ? PUBLIC_LISTING_SELECT_LEGACY
        : PUBLIC_LISTING_SELECT_WITH_IMAGES_LEGACY_TRUST;
    if (listingSelect !== trustFallbackSelect) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[vehicles] trust/filter columns missing — using legacy listing select"
        );
      }
      const fallback = await build(approvalOr, trustFallbackSelect);
      if (!fallback.error) return fallback;
    }
  }

  if (!isPendingChangesSchemaError(primary.error.message)) {
    return primary;
  }

  pendingChangesColumnAvailable = false;
  if (approvalOr === PUBLIC_LISTING_APPROVAL_APPROVED_ONLY) {
    return primary;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[vehicles] pending_changes column missing — using approved-only public filter"
    );
  }
  return build(PUBLIC_LISTING_APPROVAL_APPROVED_ONLY, listingSelect);
}

export type VehicleLookupUnresolved = {
  identifier: string;
  reason: "not_found" | "listing_pending" | "not_public";
};

export type VehicleLookupResult = {
  vehicles: Vehicle[];
  unresolved: VehicleLookupUnresolved[];
  /** Per vehicle id/slug — how the row was resolved for cart display. */
  catalog?: Record<string, CartVehicleCatalogState>;
  debug?: {
    requested: string[];
    publicHits: string[];
    adminHits: string[];
    unresolved: string[];
    error?: string;
  };
};

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), FETCH_TIMEOUT_MS)
    ),
  ]);
}

/** Listing/card views — omit heavy JSON columns (specs, history, description, gallery). */
const PUBLIC_LISTING_SELECT_WITH_IMAGES =
  "id, slug, make, model, year, trim, price, mileage, fuel_type, transmission, condition, body_type, location, featured, images, primary_image_url, additional_images, status, trust_badges, country_of_origin, financing_available, shipment_available, customs_clearing_available, available_locally, local_availability_at, created_at";

const PUBLIC_LISTING_SELECT_LEGACY =
  "id, slug, make, model, year, trim, price, mileage, fuel_type, transmission, condition, body_type, location, featured, images, status, created_at";

const PUBLIC_LISTING_SELECT_WITH_IMAGES_LEGACY_TRUST =
  "id, slug, make, model, year, trim, price, mileage, fuel_type, transmission, condition, body_type, location, featured, images, primary_image_url, additional_images, status, created_at";

function publicListingSelect(): string {
  if (vehicleImageColumnsAvailable === false) {
    return PUBLIC_LISTING_SELECT_LEGACY;
  }
  if (vehicleTrustColumnsAvailable === false) {
    return PUBLIC_LISTING_SELECT_WITH_IMAGES_LEGACY_TRUST;
  }
  return PUBLIC_LISTING_SELECT_WITH_IMAGES;
}

export interface VehicleRow {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  condition: string;
  body_type: string;
  location: string;
  engine_size?: string | null;
  color?: string | null;
  vin?: string | null;
  description?: string | null;
  featured: boolean;
  images: string[];
  primary_image_url?: string | null;
  additional_images?: string[] | null;
  gallery?: VehicleGalleryData | null;
  specs?: VehicleSpec[];
  history?: HistoryEvent[];
  status: string;
  trust_badges?: unknown;
  inspection_summary?: string | null;
  country_of_origin?: string | null;
  financing_available?: boolean | null;
  shipment_available?: boolean | null;
  customs_clearing_available?: boolean | null;
  warranty_notes?: string | null;
  walkaround_video_url?: string | null;
  available_locally?: boolean | null;
  local_availability_at?: string | null;
  created_at: string;
}

export function mapRow(row: VehicleRow): Vehicle {
  const gallery = resolveVehicleGallery({
    gallery: row.gallery as VehicleGalleryData | null,
    images: row.images ?? [],
  });
  const images = flattenGallery(gallery);
  const primaryImageUrl = resolvePrimaryImageUrl({
    primary_image_url: row.primary_image_url,
    gallery,
    images: row.images ?? [],
  });
  const additionalImages = resolveAdditionalImages({
    primary_image_url: row.primary_image_url,
    additional_images: row.additional_images,
    gallery,
    images: row.images ?? [],
  });

  return {
    id: row.id,
    slug: row.slug,
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim ?? undefined,
    price: row.price,
    mileage: row.mileage,
    fuelType: row.fuel_type as Vehicle["fuelType"],
    transmission: row.transmission as Vehicle["transmission"],
    condition: row.condition as Vehicle["condition"],
    bodyType: row.body_type as Vehicle["bodyType"],
    location: row.location,
    engineSize: row.engine_size ?? "",
    color: row.color ?? "",
    vin: row.vin ?? "",
    description: row.description ?? "",
    featured: row.featured,
    images,
    primaryImageUrl,
    additionalImages,
    gallery,
    specs: row.specs ?? [],
    history: row.history ?? [],
    status: (row.status as VehicleAvailabilityStatus) ?? "available",
    trustBadges: parseTrustBadges(row.trust_badges),
    inspectionSummary: row.inspection_summary ?? null,
    countryOfOrigin: (row.country_of_origin as CountryOfOrigin | null) ?? null,
    financingAvailable: row.financing_available ?? false,
    shipmentAvailable: row.shipment_available ?? false,
    customsClearingAvailable: row.customs_clearing_available ?? false,
    warrantyNotes: row.warranty_notes ?? null,
    walkaroundVideoUrl: row.walkaround_video_url ?? null,
    availableLocally: row.available_locally ?? false,
    localAvailabilityAt: row.local_availability_at ?? null,
    createdAt: row.created_at.split("T")[0],
  };
}

async function fetchAllVehiclesUncached(): Promise<Vehicle[]> {
  // One-shot sync of vehicles.color from audited primary photos (idempotent).
  void import("@/lib/vehicles/apply-photo-color-corrections")
    .then(({ applyInventoryPhotoColorCorrections }) =>
      applyInventoryPhotoColorCorrections()
    )
    .catch((err) => {
      console.error("[vehicles] photo color correction failed:", err);
    });

  const supabase = createServerSupabase();

  if (!supabase) {
    return developmentVehicleFallback();
  }

  try {
    const result = await withTimeout(
      runPublicListingQuery((approvalOr, listingSelect) =>
        notDeletedFilter(
          supabase
            .from("vehicles")
            .select(listingSelect)
            .in("status", PUBLIC_VEHICLE_STATUSES)
            .or(approvalOr)
        ).order("created_at", { ascending: false })
      ),
      "Supabase vehicles"
    );
    const { data, error } = result as { data: VehicleRow[] | null; error: { message: string } | null };

    if (error || !data?.length) {
      if (error) console.error("Supabase fetch failed, using mock data:", error.message);
      return isSupabaseConfigured() && data?.length === 0
        ? []
        : developmentVehicleFallback();
    }

    return data.map((row) => mapRow(row as VehicleRow));
  } catch (err) {
    console.error("Supabase fetch failed, using mock data:", err);
    return developmentVehicleFallback();
  }
}

const getCachedAllVehicles = unstable_cache(
  fetchAllVehiclesUncached,
  ["public-vehicles-all"],
  {
    revalidate: PUBLIC_VEHICLES_REVALIDATE_SECONDS,
    tags: [PUBLIC_VEHICLES_CACHE_TAG],
  }
);

/** Public inventory listing — cached 120s, busted on admin inventory saves. */
export const fetchAllVehicles = reactCache(() => getCachedAllVehicles());

export const fetchVehicleBySlug = reactCache(async (slug: string): Promise<Vehicle | null> => {
  const normalized = slug.trim();
  if (!normalized) return null;

  const supabase = createServerSupabase();

  if (!supabase) {
    if (!allowDemoData()) return null;
    return (
      mockVehicles.find(
        (v) =>
          v.slug === normalized &&
          (!v.status || v.status === "available" || v.status === "pre_order")
      ) ?? null
    );
  }

  try {
    const result = await withTimeout(
      runPublicListingQuery((approvalOr, _listingSelect) =>
        notDeletedFilter(
          supabase
            .from("vehicles")
            .select("*")
            .eq("slug", normalized)
            .in("status", PUBLIC_VEHICLE_STATUSES)
            .or(approvalOr)
        ).maybeSingle()
      ),
      "Supabase vehicle"
    );
    const { data, error } = result;

    if (!error && data) {
      return mapRow(data as VehicleRow);
    }

    if (error) {
      console.error("Supabase vehicle by slug failed:", error.message);
    }
  } catch (err) {
    console.error("Supabase vehicle fetch failed:", err);
  }

  return null;
});

export async function fetchFeaturedVehicles(): Promise<Vehicle[]> {
  const all = await fetchAllVehicles();
  return all.filter((v) => v.featured);
}

function sortLocallyAvailableVehicles(vehicles: Vehicle[]): Vehicle[] {
  return [...vehicles].sort((a, b) => {
    const aTime = a.localAvailabilityAt
      ? new Date(a.localAvailabilityAt).getTime()
      : 0;
    const bTime = b.localAvailabilityAt
      ? new Date(b.localAvailabilityAt).getTime()
      : 0;
    if (bTime !== aTime) return bTime - aTime;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const getCachedLocallyAvailableVehicles = unstable_cache(
  async () => {
    const all = await fetchAllVehiclesUncached();
    return sortLocallyAvailableVehicles(all.filter(isLocallyAvailableForBanner));
  },
  ["public-vehicles-locally-available"],
  {
    revalidate: PUBLIC_VEHICLES_REVALIDATE_SECONDS,
    tags: [PUBLIC_VEHICLES_CACHE_TAG],
  }
);

/** Public vehicles marked as locally available — cached with inventory listings. */
export const getLocallyAvailableVehicles = reactCache(() =>
  getCachedLocallyAvailableVehicles()
);

/** @deprecated Use getLocallyAvailableVehicles */
export const fetchLocallyAvailableVehicles = getLocallyAvailableVehicles;

export type CheckoutVehicleRecord = {
  id: string;
  slug: string;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  price: number | null;
  status: string | null;
};

function matchMockByIdentifiers(identifiers: string[]): Vehicle[] {
  if (!allowDemoData()) return [];
  const idSet = new Set(identifiers);
  return mockVehicles.filter((v) => idSet.has(v.id) || idSet.has(v.slug));
}

function logMissingVehicleIds(identifiers: string[], found: Map<string, Vehicle>) {
  if (process.env.NODE_ENV !== "development") return;
  const missing = identifiers.filter((key) => !found.has(key));
  if (missing.length) {
    console.warn("[vehicles/lookup] identifiers not publicly listed:", missing);
  }
}

type AdminVehicleRow = VehicleRow & {
  approval_status: string | null;
  pending_changes: unknown;
};

const ADMIN_VEHICLE_LOOKUP_SELECT = "*";

async function selectAdminVehicles(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  column: "id" | "slug",
  values: string[]
): Promise<AdminVehicleRow[] | null> {
  if (!values.length) return null;

  const primary = await admin
    .from("vehicles")
    .select(ADMIN_VEHICLE_LOOKUP_SELECT)
    .in(column, values);
  if (!primary.error || !isPendingChangesSchemaError(primary.error.message)) {
    return primary.data as AdminVehicleRow[] | null;
  }

  const fallback = await admin
    .from("vehicles")
    .select("*")
    .in(column, values);
  if (fallback.error) {
    console.error(`Admin vehicles by ${column} failed:`, fallback.error.message);
    return null;
  }
  return fallback.data as AdminVehicleRow[] | null;
}

function catalogStateForRow(
  row: AdminVehicleRow,
  source: "public" | "admin"
): CartVehicleCatalogState {
  return {
    source,
    approvalStatus: row.approval_status ?? null,
    publiclyListed: isPubliclyListed(row.approval_status, row.pending_changes),
    listingPending: isPendingNewListing(row.approval_status, row.pending_changes),
  };
}

function attachCatalogEntries(
  catalog: Record<string, CartVehicleCatalogState>,
  vehicle: Vehicle,
  state: CartVehicleCatalogState
) {
  catalog[vehicle.id] = state;
  catalog[vehicle.slug] = state;
}

/** Classify identifiers missing from the public inventory query. */
async function classifyUnresolvedIdentifiers(
  identifiers: string[],
  publicByKey: Map<string, Vehicle>
): Promise<VehicleLookupUnresolved[]> {
  const missing = identifiers.filter((key) => !publicByKey.has(key));
  if (!missing.length) return [];

  const admin = createAdminSupabase();
  if (!admin) {
    return missing.map((identifier) => ({ identifier, reason: "not_found" as const }));
  }

  const { unique, ids, slugs } = splitVehicleIdentifiers(missing);
  const adminByKey = new Map<string, AdminVehicleRow>();

  const addAdminRows = (rows: AdminVehicleRow[] | null) => {
    for (const row of rows ?? []) {
      adminByKey.set(row.id, row);
      adminByKey.set(row.slug, row);
    }
  };

  const [idRows, slugRows] = await Promise.all([
    ids.length ? selectAdminVehicles(admin, "id", ids) : Promise.resolve(null),
    slugs.length ? selectAdminVehicles(admin, "slug", slugs) : Promise.resolve(null),
  ]);
  addAdminRows(idRows);
  addAdminRows(slugRows);

  return unique.map((identifier) => {
    const row = adminByKey.get(identifier);
    if (!row) return { identifier, reason: "not_found" as const };
    if (isPendingNewListing(row.approval_status, row.pending_changes)) {
      return { identifier, reason: "listing_pending" as const };
    }
    return { identifier, reason: "not_public" as const };
  });
}

async function queryPublicVehiclesByIdentifiers(
  identifiers: string[],
  supabase: NonNullable<ReturnType<typeof createServerSupabase>>
): Promise<Map<string, Vehicle>> {
  const { unique, ids, slugs } = splitVehicleIdentifiers(identifiers);
  const byKey = new Map<string, Vehicle>();

  const addRows = (rows: VehicleRow[] | null) => {
    for (const row of rows ?? []) {
      const vehicle = mapRow(row);
      byKey.set(vehicle.id, vehicle);
      byKey.set(vehicle.slug, vehicle);
    }
  };

  const [idsResult, slugsResult] = await Promise.all([
    ids.length
      ? withTimeout(
          runPublicListingQuery((approvalOr, _listingSelect) =>
            notDeletedFilter(
              supabase
                .from("vehicles")
                .select("*")
                .in("id", ids)
                .in("status", PUBLIC_VEHICLE_STATUSES)
                .or(approvalOr)
            )
          ),
          "Supabase vehicles by id"
        )
      : Promise.resolve({ data: null as VehicleRow[] | null, error: null }),
    slugs.length
      ? withTimeout(
          runPublicListingQuery((approvalOr, _listingSelect) =>
            notDeletedFilter(
              supabase
                .from("vehicles")
                .select("*")
                .in("slug", slugs)
                .in("status", PUBLIC_VEHICLE_STATUSES)
                .or(approvalOr)
            )
          ),
          "Supabase vehicles by slug"
        )
      : Promise.resolve({ data: null as VehicleRow[] | null, error: null }),
  ]);

  if (idsResult.error) {
    console.error("Supabase vehicles by id failed:", idsResult.error.message);
  }
  if (slugsResult.error) {
    console.error("Supabase vehicles by slug failed:", slugsResult.error.message);
  }
  addRows(idsResult.data as VehicleRow[] | null);
  addRows(slugsResult.data as VehicleRow[] | null);

  for (const key of unique) {
    const vehicle = byKey.get(key);
    if (vehicle) byKey.set(key, vehicle);
  }

  logMissingVehicleIds(unique, byKey);
  return byKey;
}

/** Admin fallback — same vehicles table as Platform inventory, without public filters. */
async function queryAdminVehiclesByIdentifiers(
  identifiers: string[],
  excludeKeys: ReadonlySet<string>,
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<{
  byKey: Map<string, Vehicle>;
  catalog: Record<string, CartVehicleCatalogState>;
}> {
  const missing = identifiers.filter((key) => !excludeKeys.has(key));
  const { unique, ids, slugs } = splitVehicleIdentifiers(missing);
  const byKey = new Map<string, Vehicle>();
  const catalog: Record<string, CartVehicleCatalogState> = {};

  const addRows = (rows: AdminVehicleRow[] | null) => {
    for (const row of rows ?? []) {
      const vehicle = mapRow(row);
      const state = catalogStateForRow(row, "admin");
      byKey.set(vehicle.id, vehicle);
      byKey.set(vehicle.slug, vehicle);
      attachCatalogEntries(catalog, vehicle, state);
    }
  };

  const [idRows, slugRows] = await Promise.all([
    ids.length ? selectAdminVehicles(admin, "id", ids) : Promise.resolve(null),
    slugs.length ? selectAdminVehicles(admin, "slug", slugs) : Promise.resolve(null),
  ]);
  addRows(idRows);
  addRows(slugRows);

  for (const key of unique) {
    const vehicle = byKey.get(key);
    if (vehicle) byKey.set(key, vehicle);
  }

  return { byKey, catalog };
}

/** Resolve cart/garage IDs (UUID or legacy slug) to publicly listed vehicle records. */
export async function resolvePublicVehiclesByIdentifiers(
  identifiers: string[],
  supabase?: NonNullable<ReturnType<typeof createServerSupabase>> | null
): Promise<VehicleLookupResult> {
  const { unique } = splitVehicleIdentifiers(identifiers);
  if (!unique.length) return { vehicles: [], unresolved: [] };

  const client = supabase ?? createServerSupabase();

  if (!client) {
    const vehicles = matchMockByIdentifiers(unique);
    const found = new Map<string, Vehicle>();
    for (const vehicle of vehicles) {
      found.set(vehicle.id, vehicle);
      found.set(vehicle.slug, vehicle);
    }
    const unresolved = unique
      .filter((key) => !found.has(key))
      .map((identifier) => ({ identifier, reason: "not_found" as const }));
    return {
      vehicles: unique
        .map((key) => found.get(key))
        .filter((v): v is Vehicle => Boolean(v)),
      unresolved,
    };
  }

  try {
    const byKey = await queryPublicVehiclesByIdentifiers(unique, client);
    const catalog: Record<string, CartVehicleCatalogState> = {};
    const publicVehicles = new Map<string, Vehicle>();

    for (const vehicle of byKey.values()) {
      if (publicVehicles.has(vehicle.id)) continue;
      publicVehicles.set(vehicle.id, vehicle);
      attachCatalogEntries(catalog, vehicle, {
        source: "public",
        approvalStatus: "approved",
        publiclyListed: true,
        listingPending: false,
      });
    }

    const admin = createAdminSupabase();
    let adminByKey = new Map<string, Vehicle>();
    if (admin) {
      const adminResult = await queryAdminVehiclesByIdentifiers(
        unique,
        new Set(byKey.keys()),
        admin
      );
      adminByKey = adminResult.byKey;
      Object.assign(catalog, adminResult.catalog);
      for (const vehicle of adminByKey.values()) {
        if (!publicVehicles.has(vehicle.id)) {
          publicVehicles.set(vehicle.id, vehicle);
        }
      }
    }

    const mergedByKey = new Map<string, Vehicle>(byKey);
    for (const [key, vehicle] of adminByKey) {
      if (!mergedByKey.has(key)) mergedByKey.set(key, vehicle);
    }

    const vehicles = [...publicVehicles.values()];
    const unresolved = await classifyUnresolvedIdentifiers(unique, mergedByKey);

    const result: VehicleLookupResult = { vehicles, unresolved, catalog };
    if (process.env.NODE_ENV === "development") {
      result.debug = {
        requested: unique,
        publicHits: [...byKey.keys()],
        adminHits: [...adminByKey.keys()],
        unresolved: unresolved.map((entry) => entry.identifier),
      };
    }
    return result;
  } catch (err) {
    console.error("Supabase vehicle lookup failed:", err);
    if (isSupabaseConfigured()) {
      const unresolved = unique.map((identifier) => ({
        identifier,
        reason: "not_found" as const,
      }));
      return {
        vehicles: [],
        unresolved,
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            requested: unique,
            publicHits: [],
            adminHits: [],
            unresolved: unique,
            error: err instanceof Error ? err.message : String(err),
          },
        }),
      };
    }
    const vehicles = matchMockByIdentifiers(unique);
    const found = new Map<string, Vehicle>();
    for (const vehicle of vehicles) {
      found.set(vehicle.id, vehicle);
      found.set(vehicle.slug, vehicle);
    }
    return {
      vehicles: unique
        .map((key) => found.get(key))
        .filter((v): v is Vehicle => Boolean(v)),
      unresolved: unique
        .filter((key) => !found.has(key))
        .map((identifier) => ({ identifier, reason: "not_found" as const })),
    };
  }
}

/** Resolve saved garage IDs (UUID or legacy slug) to full vehicle records. */
export async function fetchVehiclesByIdentifiers(identifiers: string[]): Promise<Vehicle[]> {
  const { vehicles } = await resolvePublicVehiclesByIdentifiers(identifiers);
  return vehicles;
}

const CHECKOUT_VEHICLE_SELECT =
  "id, slug, year, make, model, trim, price, status";

/** Checkout-time lookup — same public listing rules as /auto/inventory. */
export async function fetchCheckoutVehiclesByIdentifiers(
  identifiers: string[],
  supabase: NonNullable<ReturnType<typeof createServerSupabase>>
): Promise<Map<string, CheckoutVehicleRecord>> {
  const { unique, ids, slugs } = splitVehicleIdentifiers(identifiers);
  const byKey = new Map<string, CheckoutVehicleRecord>();

  const addRows = (rows: CheckoutVehicleRecord[] | null) => {
    for (const row of rows ?? []) {
      byKey.set(row.id, row);
      byKey.set(row.slug, row);
    }
  };

  const [idsResult, slugsResult] = await Promise.all([
    ids.length
      ? runPublicListingQuery((approvalOr, _listingSelect) =>
          notDeletedFilter(
            supabase
              .from("vehicles")
              .select(CHECKOUT_VEHICLE_SELECT)
              .in("id", ids)
              .in("status", PUBLIC_VEHICLE_STATUSES)
              .or(approvalOr)
          )
        ).then((r) => ({
          data: r.data as CheckoutVehicleRecord[] | null,
          error: r.error,
        }))
      : Promise.resolve({ data: null as CheckoutVehicleRecord[] | null, error: null }),
    slugs.length
      ? runPublicListingQuery((approvalOr, _listingSelect) =>
          notDeletedFilter(
            supabase
              .from("vehicles")
              .select(CHECKOUT_VEHICLE_SELECT)
              .in("slug", slugs)
              .in("status", PUBLIC_VEHICLE_STATUSES)
              .or(approvalOr)
          )
        ).then((r) => ({
          data: r.data as CheckoutVehicleRecord[] | null,
          error: r.error,
        }))
      : Promise.resolve({ data: null as CheckoutVehicleRecord[] | null, error: null }),
  ]);

  if (idsResult.error) {
    console.error("Checkout vehicles by id failed:", idsResult.error.message);
  }
  if (slugsResult.error) {
    console.error("Checkout vehicles by slug failed:", slugsResult.error.message);
  }
  addRows(idsResult.data as CheckoutVehicleRecord[] | null);
  addRows(slugsResult.data as CheckoutVehicleRecord[] | null);

  for (const key of unique) {
    const vehicle = byKey.get(key);
    if (vehicle) byKey.set(key, vehicle);
  }

  if (process.env.NODE_ENV === "development") {
    const missing = unique.filter((key) => !byKey.has(key));
    if (missing.length) {
      console.warn("[parts/orders] checkout vehicles not publicly listed:", missing);
    }
  }

  return byKey;
}
