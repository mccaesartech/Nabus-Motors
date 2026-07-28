import { SearchX } from "lucide-react";
import { PlatformStatus } from "@/components/platform/platform-status";
import { platformPath } from "@/lib/platform/paths";

export default function PlatformNotFound() {
  return (
    <PlatformStatus
      code={404}
      icon={SearchX}
      title="That dashboard page does not exist"
      description="The link may be out of date, or the record may have been deleted or moved to Trash."
      actions={[
        { label: "Back to dashboard", href: platformPath("dashboard") },
        { label: "Open Trash", href: platformPath("trash") },
      ]}
    />
  );
}
