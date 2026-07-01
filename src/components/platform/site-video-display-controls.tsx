"use client";

import {
  DEFAULT_VIDEO_DISPLAY,
  VIDEO_ASPECT_OPTIONS,
  VIDEO_OBJECT_FIT_OPTIONS,
  VIDEO_SIZE_OPTIONS,
  type SiteVideoDisplaySettings,
} from "@/lib/site-content/video-display";

type SiteVideoDisplayControlsProps = {
  settings: Partial<SiteVideoDisplaySettings>;
  onChange: (patch: Partial<SiteVideoDisplaySettings>) => void;
  /** Hide size controls for full-bleed background videos */
  hideSize?: boolean;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--platform-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

export function SiteVideoDisplayControls({
  settings,
  onChange,
  hideSize = false,
}: SiteVideoDisplayControlsProps) {
  const resolved = { ...DEFAULT_VIDEO_DISPLAY, ...settings };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Orientation / aspect ratio">
        <select
          className="platform-input w-full text-sm"
          value={resolved.videoAspect}
          onChange={(e) =>
            onChange({ videoAspect: e.target.value as SiteVideoDisplaySettings["videoAspect"] })
          }
        >
          {VIDEO_ASPECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      {!hideSize && (
        <Field label="Display size">
          <div className="flex flex-wrap gap-2">
            {VIDEO_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.label}
                onClick={() => onChange({ videoSize: opt.value })}
                className={[
                  "min-w-[3rem] rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  resolved.videoSize === opt.value
                    ? "border-[var(--platform-accent)] bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]"
                    : "border-[var(--platform-border)] text-[var(--platform-text-secondary)] hover:border-[var(--platform-accent)]/50",
                ].join(" ")}
              >
                {opt.short}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="How video fills frame">
        <select
          className="platform-input w-full text-sm"
          value={resolved.videoObjectFit}
          onChange={(e) =>
            onChange({
              videoObjectFit: e.target.value as SiteVideoDisplaySettings["videoObjectFit"],
            })
          }
        >
          {VIDEO_OBJECT_FIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
