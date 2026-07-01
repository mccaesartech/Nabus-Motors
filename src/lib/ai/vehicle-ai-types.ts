import type { VehicleInput } from "@/lib/admin/vehicle-fields";

export type VehicleAiAction = "improve_description" | "fill_fields" | "custom";

export type VehicleAiSuggestions = {
  description?: string;
  title?: string;
  fieldUpdates?: Partial<
    Pick<
      VehicleInput,
      | "description"
      | "trim"
      | "color"
      | "engine_size"
      | "make"
      | "model"
      | "year"
    >
  >;
  notes?: string;
};
