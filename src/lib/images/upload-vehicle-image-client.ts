import { prepareImageForUpload } from "@/lib/images/prepare-client-upload";

const UPLOAD_ENDPOINT = "/api/admin/vehicles/upload-image";

export const NON_VEHICLE_IMAGE_CODE = "NON_VEHICLE_IMAGE";

export type VehicleImageUploadResult =
  | { ok: true; url: string }
  | {
      ok: false;
      message: string;
      code?: string;
      requiresConfirmation?: boolean;
      reason?: string;
    };

export type UploadVehicleImageOptions = {
  /** Admin explicitly confirmed a non-vehicle image is intentional. */
  confirmNonVehicle?: boolean;
};

/**
 * Prepare (client compress) + POST a single vehicle image to storage.
 * Sets `preprocessed=1` so the API uses the light enhance path.
 */
export async function uploadVehicleImageFile(
  file: File,
  options?: UploadVehicleImageOptions
): Promise<VehicleImageUploadResult> {
  const prepared = await prepareImageForUpload(file);
  const formData = new FormData();
  formData.append("file", prepared);
  formData.append("preprocessed", "1");
  if (options?.confirmNonVehicle) {
    formData.append("confirmNonVehicle", "1");
  }

  try {
    const res = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
    });
    const json = (await res.json()) as {
      ok?: boolean;
      url?: string;
      message?: string;
      code?: string;
      requiresConfirmation?: boolean;
      reason?: string;
    };
    if (!res.ok || !json.ok || typeof json.url !== "string") {
      return {
        ok: false,
        message: json.message ?? "Upload failed",
        code: typeof json.code === "string" ? json.code : undefined,
        requiresConfirmation: Boolean(json.requiresConfirmation),
        reason: typeof json.reason === "string" ? json.reason : undefined,
      };
    }
    return { ok: true, url: json.url };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Upload failed",
    };
  }
}
