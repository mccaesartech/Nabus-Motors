"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountEmptyState } from "@/components/account/account-empty-state";
import {
  CustomRequestBookVisitLink,
  CustomRequestMessageTrigger,
} from "@/components/account/custom-request-message-panel";
import type { CustomerConversation, CustomerInquirySummary } from "@/lib/customer/types";
import {
  customRequestStatusLabel,
  formatBudgetRangeGhs,
  parseCustomRequestSpecs,
} from "@/lib/platform/custom-request";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type VehicleRequestsSectionProps = {
  requests: CustomerInquirySummary[];
  conversations: CustomerConversation[];
  loading: boolean;
  highlightedRequestId?: string | null;
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "can_source":
      return "bg-green-100 text-green-800";
    case "matched":
      return "bg-brand-purple/15 text-brand-purple";
    case "cannot_source":
      return "bg-red-100 text-red-800";
    default:
      return "bg-amber-100 text-amber-900";
  }
}

function notesSummary(specs: ReturnType<typeof parseCustomRequestSpecs>): string | null {
  if (specs.notes?.trim()) {
    const trimmed = specs.notes.trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }
  const parts = [specs.body_type, specs.fuel_type, specs.condition, specs.preferred_timeline]
    .filter(Boolean)
    .join(" · ");
  return parts || null;
}

export function VehicleRequestsSection({
  requests,
  conversations,
  customer,
  loading,
  highlightedRequestId,
}: VehicleRequestsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(highlightedRequestId ?? null);

  const conversationByPreorderId = new Map(
    conversations
      .filter((c) => c.preorder_id)
      .map((c) => [c.preorder_id as string, c.id])
  );

  return (
    <section
      id="vehicle-requests"
      className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4"
    >
      <AccountSectionHeader
        icon={<Search className="size-5" />}
        title="Vehicle requests"
        description="Custom vehicles you've asked us to source. Track status, message our team, or book a visit anytime."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading vehicle requests…</p>
      ) : requests.length === 0 ? (
        <AccountEmptyState
          icon={<Search className="size-7" />}
          title="No vehicle requests yet"
          description="Can't find what you want in our inventory? Tell us the make, model, and budget — we'll review sourcing options."
          actionLabel="Submit a custom request"
          actionHref={ROUTES.auto.customRequest}
        />
      ) : (
        <ul className="space-y-4">
          {requests.map((item) => {
            const specs = parseCustomRequestSpecs(item.requested_specs);
            const budget = formatBudgetRangeGhs(item.budget_min, item.budget_max);
            const summary = notesSummary(specs);
            const isExpanded = expandedId === item.id;
            const isHighlighted = highlightedRequestId === item.id;
            const existingConversationId = conversationByPreorderId.get(item.id);

            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border bg-card transition-shadow",
                  isHighlighted && "ring-2 ring-brand-purple/40"
                )}
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.reference_code && (
                        <span className="font-mono text-sm font-semibold text-brand-purple">
                          {item.reference_code}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusBadgeClass(item.status)
                        )}
                      >
                        {customRequestStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="font-medium">
                      {[item.requested_year, item.requested_make, item.requested_model]
                        .filter(Boolean)
                        .join(" ") || item.title.replace(/^Custom request — /, "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {item.created_at.slice(0, 10)}
                      {budget && <> · Budget: {budget}</>}
                    </p>
                    {summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{summary}</p>
                    )}
                    {item.status === "matched" && item.matched_vehicle_slug && (
                      <Link
                        href={ROUTES.auto.inventoryDetail(item.matched_vehicle_slug)}
                        className="inline-block text-xs font-medium text-brand-purple hover:underline"
                      >
                        View matched listing
                      </Link>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-brand-purple"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {isExpanded ? "Hide details" : "View details"}
                      <ChevronDown
                        className={cn("size-4 transition-transform", isExpanded && "rotate-180")}
                      />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      {item.requested_make && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Make
                          </dt>
                          <dd>{item.requested_make}</dd>
                        </div>
                      )}
                      {item.requested_model && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Model
                          </dt>
                          <dd>{item.requested_model}</dd>
                        </div>
                      )}
                      {item.requested_year && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Year
                          </dt>
                          <dd>{item.requested_year}</dd>
                        </div>
                      )}
                      {budget && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Budget (GHS)
                          </dt>
                          <dd>{budget}</dd>
                        </div>
                      )}
                      {specs.body_type && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Body type
                          </dt>
                          <dd>{specs.body_type}</dd>
                        </div>
                      )}
                      {specs.fuel_type && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fuel type
                          </dt>
                          <dd>{specs.fuel_type}</dd>
                        </div>
                      )}
                      {specs.condition && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Condition
                          </dt>
                          <dd>{specs.condition}</dd>
                        </div>
                      )}
                      {specs.preferred_timeline && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Timeline
                          </dt>
                          <dd>{specs.preferred_timeline}</dd>
                        </div>
                      )}
                      {specs.notes && (
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Notes
                          </dt>
                          <dd className="whitespace-pre-wrap">{specs.notes}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                  <OrderPrintActions
                    getHtml={() => buildCustomRequestDocumentHtml(item, customer)}
                    printLabel="Print request summary"
                  />
                  <CustomRequestMessageTrigger
                    context={{
                      requestId: item.id,
                      referenceCode: item.reference_code,
                      title: item.title,
                    }}
                    existingConversationId={existingConversationId}
                  />
                  <CustomRequestBookVisitLink />
                  {existingConversationId && (
                    <Button
                      render={
                        <Link
                          href={`/account?conversation=${encodeURIComponent(existingConversationId)}#messages`}
                        />
                      }
                      variant="ghost"
                      size="sm"
                    >
                      Open thread
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
