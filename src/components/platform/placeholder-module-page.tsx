import { ModuleShell } from "@/components/platform/empty-state";
import { PageHeader } from "@/components/platform/page-header";
import type { LucideIcon } from "lucide-react";

type PlaceholderModulePageProps = {
  title: string;
  description: string;
  breadcrumb: string;
  icon: LucideIcon;
  features: string[];
};

export function PlaceholderModulePage({
  title,
  description,
  breadcrumb,
  icon: Icon,
  features,
}: PlaceholderModulePageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} breadcrumb={breadcrumb} />
      <ModuleShell icon={<Icon className="size-5" />} title={title} description={description} features={features} />
    </div>
  );
}
