"use client";

import { Info } from "lucide-react";
import {
  DEFAULT_VIDEO_EMBED,
  type SiteVideoEmbedSettings,
} from "@/lib/site-content/video-embed";

type SiteVideoEmbedControlsProps = {
  settings: Partial<SiteVideoEmbedSettings>;
  onChange: (patch: Partial<SiteVideoEmbedSettings>) => void;
  /** Only show when a YouTube/Vimeo link is set */
  show?: boolean;
};

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--platform-border)] px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--platform-accent)]"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-[var(--platform-text)]">{label}</span>
        {description && (
          <span className="block text-xs text-[var(--platform-text-secondary)]">{description}</span>
        )}
      </span>
    </label>
  );
}

export function SiteVideoEmbedControls({
  settings,
  onChange,
  show = true,
}: SiteVideoEmbedControlsProps) {
  if (!show) return null;

  const resolved = { ...DEFAULT_VIDEO_EMBED, ...settings };

  return (
    <div className="space-y-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-4">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--platform-accent)]" />
        <div className="space-y-1 text-xs text-[var(--platform-text-secondary)]">
          <p className="font-medium text-[var(--platform-text)]">YouTube / Vimeo embed options</p>
          <p>
            YouTube&apos;s terms require some branding (logo, title on hover, &quot;Watch on
            YouTube&quot;). These options reduce it as much as allowed — they cannot remove it
            entirely.
          </p>
          <p>
            For <strong className="font-medium text-[var(--platform-text)]">no YouTube text at
            all</strong>, upload an MP4 or WebM file instead of pasting a link.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          label="Minimal YouTube branding"
          description="Smaller logo, privacy-enhanced embed, no annotations"
          checked={resolved.embedMinimalBranding}
          onChange={(embedMinimalBranding) => onChange({ embedMinimalBranding })}
        />
        <Toggle
          label="Hide player controls"
          description="No play bar, fullscreen button, or keyboard shortcuts"
          checked={resolved.embedHideControls}
          onChange={(embedHideControls) => onChange({ embedHideControls })}
        />
        <Toggle
          label="Hide related videos at end"
          description="YouTube rel=0 — limits suggested videos when playback ends"
          checked={resolved.embedHideRelated}
          onChange={(embedHideRelated) => onChange({ embedHideRelated })}
        />
      </div>
    </div>
  );
}
