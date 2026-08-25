import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revalidatePath, revalidateTag } from "next/cache";
import { revalidatePublicSite } from "@/lib/admin/revalidate";

describe("revalidatePublicSite", () => {
  it("expires the public-vehicles tag immediately", () => {
    revalidatePublicSite("toyota-camry-2020");
    expect(revalidateTag).toHaveBeenCalledWith("public-vehicles", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/auto/inventory/toyota-camry-2020");
  });
});
