import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import type { VehicleGalleryData } from "@/lib/types";

export type VehicleAiChatRole = "user" | "assistant";

export type VehicleAiChatMessage = {
  role: VehicleAiChatRole;
  content: string;
};

export type VehicleAiChatChanges = Partial<
  Pick<
    VehicleInput,
    | "make"
    | "model"
    | "year"
    | "trim"
    | "price"
    | "mileage"
    | "fuel_type"
    | "transmission"
    | "condition"
    | "body_type"
    | "location"
    | "engine_size"
    | "color"
    | "vin"
    | "description"
    | "featured"
    | "status"
    | "inspection_summary"
    | "warranty_notes"
    | "drivetrain"
    | "horsepower"
    | "range"
    | "seating_capacity"
  >
> & {
  gallery?: Partial<VehicleGalleryData>;
  /** Remove these URLs from any gallery category. */
  removeFromGallery?: string[];
  /** Replace the full gallery (e.g. reorder hero). */
  replaceGallery?: VehicleGalleryData;
  /** Append bullet lines to description (e.g. feature list). */
  appendToDescription?: string;
};

export type VehicleAiChatVehicleState = VehicleInput & {
  gallery: VehicleGalleryData;
  slug?: string;
};

export type VehiclePhotoSource = "pexels";

export type VehicleAiChatResponse = {
  reply: string;
  changes?: VehicleAiChatChanges;
  suggestedImages?: VehicleGalleryData;
  /** Present when photos came from the free Pexels pool (no Gemini). */
  photoSource?: VehiclePhotoSource;
  geminiSkipped?: boolean;
  /** Overall suggestion confidence when the model provided it. */
  confidence?: "high" | "medium" | "low";
};

export type VehicleAiChatClientMessage = VehicleAiChatMessage & {
  id: string;
  proposedChanges?: VehicleAiChatChanges;
  proposedImages?: VehicleGalleryData;
  photoSource?: VehiclePhotoSource;
  applied?: boolean;
  /** URLs added to gallery from this message (for undo). */
  addedToGallery?: { urls: string[]; undone?: boolean };
  /** Pasted or uploaded image shown in chat. */
  pastedImageUrl?: string;
  /** Before/after preview for color filter or 4K enhance edits (pending until Approve). */
  imageEditPreview?: {
    before: string;
    after: string;
    /** Inline data URL for reliable After thumbnails (avoids CDN race). */
    afterPreview?: string;
    preset: string;
  };
  /** Admin dismissed a pending proposal without applying. */
  dismissed?: boolean;
};
