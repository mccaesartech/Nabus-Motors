import { FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
}

type MilestoneAttachmentsProps = {
  urls: string[];
  className?: string;
};

export function MilestoneAttachments({ urls, className }: MilestoneAttachmentsProps) {
  const attachments = urls.map((u) => u.trim()).filter(Boolean);
  if (attachments.length === 0) return null;

  return (
    <div className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {attachments.map((url) => {
        const label = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "Attachment");
        if (isImageUrl(url)) {
          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={label}
                className="h-16 w-24 object-cover transition-opacity hover:opacity-90"
              />
            </a>
          );
        }

        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[10rem] truncate">{label}</span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
