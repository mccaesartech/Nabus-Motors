"use client";

import { useParams } from "next/navigation";
import { usePathname } from "next/navigation";
import { LeadInquiryDetail } from "@/components/platform/lead-inquiry-detail";
import { useMarkNotificationsOnVisit } from "@/hooks/use-mark-notifications-read";
import {
  isInquiryDetailType,
  type InquiryDetailType,
} from "@/lib/platform/lead-detail";
import { platformPath } from "@/lib/platform/paths";
import { PageHeader } from "@/components/platform/page-header";

export default function LeadInquiryDetailPage() {
  const pathname = usePathname() ?? "";
  const params = useParams();
  const type = String(params.type ?? "");
  const id = String(params.id ?? "");

  useMarkNotificationsOnVisit({ link: pathname });

  if (!isInquiryDetailType(type)) {
    return (
      <PageHeader
        title="Invalid lead type"
        breadcrumb="Leads"
        backFallbackHref={platformPath("leads")}
        backLabel="Back to leads"
      />
    );
  }

  return <LeadInquiryDetail type={type as InquiryDetailType} id={id} />;
}
