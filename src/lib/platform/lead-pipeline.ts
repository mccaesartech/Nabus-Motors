import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeletedFilter } from "@/lib/platform/trash-types";

export const LEAD_PIPELINE_TABLES = [
  "contact_inquiries",
  "vehicle_inquiries",
  "preorder_inquiries",
  "finance_applications",
  "appraisal_requests",
] as const;

export type LeadPipelineStage = "new" | "contacted" | "qualified" | "won" | "lost";

export type LeadPipelineCounts = Record<LeadPipelineStage, number> & {
  total: number;
};

export const LEAD_PIPELINE_STAGE_LABELS: Record<LeadPipelineStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

const EMPTY_PIPELINE: LeadPipelineCounts = {
  new: 0,
  contacted: 0,
  qualified: 0,
  won: 0,
  lost: 0,
  total: 0,
};

/** Map inquiry status values (incl. custom preorder) to dashboard pipeline buckets. */
export function normalizeLeadPipelineStage(status: string | null | undefined): LeadPipelineStage {
  const value = (status ?? "new").trim().toLowerCase();
  if (!value) return "new";

  switch (value) {
    case "new":
    case "pending":
    case "reviewing":
      return "new";
    case "contacted":
      return "contacted";
    case "qualified":
    case "can_source":
    case "matched":
      return "qualified";
    case "sold":
    case "completed":
    case "fulfilled":
    case "confirmed":
    case "shipped":
      return "won";
    case "closed":
    case "cancelled":
    case "canceled":
    case "cannot_source":
      return "lost";
    default:
      return "new";
  }
}

export function aggregateLeadPipelineCounts(statuses: Array<string | null | undefined>): LeadPipelineCounts {
  const counts: LeadPipelineCounts = { ...EMPTY_PIPELINE };

  for (const status of statuses) {
    const stage = normalizeLeadPipelineStage(status);
    counts[stage] += 1;
    counts.total += 1;
  }

  return counts;
}

export function mergeLeadPipelineCounts(...parts: LeadPipelineCounts[]): LeadPipelineCounts {
  const merged: LeadPipelineCounts = { ...EMPTY_PIPELINE };

  for (const part of parts) {
    for (const stage of Object.keys(LEAD_PIPELINE_STAGE_LABELS) as LeadPipelineStage[]) {
      merged[stage] += part[stage] ?? 0;
    }
    merged.total += part.total ?? 0;
  }

  return merged;
}

export async function countLeadPipelineStages(
  supabase: SupabaseClient
): Promise<LeadPipelineCounts> {
  const tableResults = await Promise.all(
    LEAD_PIPELINE_TABLES.map(async (table) => {
      const { data, error } = await notDeletedFilter(
        supabase.from(table).select("status")
      );

      if (error) {
        console.error(`[lead-pipeline] ${table}:`, error.message);
        return [] as string[];
      }

      return (data ?? []).map((row) => String(row.status ?? "new"));
    })
  );

  return aggregateLeadPipelineCounts(tableResults.flat());
}
