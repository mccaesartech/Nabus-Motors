import { describe, expect, it } from "vitest";
import {
  aggregateLeadPipelineCounts,
  mergeLeadPipelineCounts,
  normalizeLeadPipelineStage,
} from "@/lib/platform/lead-pipeline";

describe("normalizeLeadPipelineStage", () => {
  it("maps standard lead statuses", () => {
    expect(normalizeLeadPipelineStage("new")).toBe("new");
    expect(normalizeLeadPipelineStage("pending")).toBe("new");
    expect(normalizeLeadPipelineStage("contacted")).toBe("contacted");
    expect(normalizeLeadPipelineStage("qualified")).toBe("qualified");
    expect(normalizeLeadPipelineStage("sold")).toBe("won");
    expect(normalizeLeadPipelineStage("closed")).toBe("lost");
  });

  it("maps custom preorder statuses", () => {
    expect(normalizeLeadPipelineStage("reviewing")).toBe("new");
    expect(normalizeLeadPipelineStage("can_source")).toBe("qualified");
    expect(normalizeLeadPipelineStage("cannot_source")).toBe("lost");
    expect(normalizeLeadPipelineStage("matched")).toBe("qualified");
  });
});

describe("aggregateLeadPipelineCounts", () => {
  it("counts stages across mixed statuses", () => {
    const counts = aggregateLeadPipelineCounts([
      "new",
      "pending",
      "contacted",
      "qualified",
      "sold",
      "closed",
      "reviewing",
    ]);

    expect(counts).toEqual({
      new: 3,
      contacted: 1,
      qualified: 1,
      won: 1,
      lost: 1,
      total: 7,
    });
  });
});

describe("mergeLeadPipelineCounts", () => {
  it("sums pipeline buckets", () => {
    const merged = mergeLeadPipelineCounts(
      { new: 2, contacted: 1, qualified: 0, won: 0, lost: 0, total: 3 },
      { new: 1, contacted: 0, qualified: 2, won: 1, lost: 0, total: 4 }
    );

    expect(merged).toEqual({
      new: 3,
      contacted: 1,
      qualified: 2,
      won: 1,
      lost: 0,
      total: 7,
    });
  });
});
