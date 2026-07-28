"use client";

import { useCallback, useRef, useState } from "react";
import { Film, Loader2, Upload, X } from "lucide-react";
import { describeApiFailure, friendlyErrorMessage } from "@/lib/errors/client";
import { isValidVideoUrl, parseEmbedVideoUrl } from "@/lib/site-content/video";
import {
  getVideoFrameClassName,
  getVideoMediaClassName,
  getVideoWrapperClassName,
  type SiteVideoDisplaySettings,
} from "@/lib/site-content/video-display";
import type { SiteVideoEmbedSettings } from "@/lib/site-content/video-embed";
import { SiteVideoDisplayControls } from "@/components/platform/site-video-display-controls";
import { SiteVideoEmbedControls } from "@/components/platform/site-video-embed-controls";

const VIDEO_UPLOAD_FAILED_MESSAGE =
  "That video could not be uploaded. Use an MP4 or WebM under 50MB and try again.";

type SiteVideoUploadProps = {
  label?: string;
  hint?: string;
  fileUrl: string;
  embedUrl: string;
  onFileUrlChange: (url: string) => void;
  onEmbedUrlChange: (url: string) => void;
  uploadEndpoint?: string;
  display?: Partial<SiteVideoDisplaySettings>;
  onDisplayChange?: (patch: Partial<SiteVideoDisplaySettings>) => void;
  embed?: Partial<SiteVideoEmbedSettings>;
  onEmbedChange?: (patch: Partial<SiteVideoEmbedSettings>) => void;
  hideDisplaySize?: boolean;
};

export function SiteVideoUpload({
  label,
  hint,
  fileUrl,
  embedUrl,
  onFileUrlChange,
  onEmbedUrlChange,
  uploadEndpoint = "/api/admin/site-content/upload",
  display,
  onDisplayChange,
  embed,
  onEmbedChange,
  hideDisplaySize = false,
}: SiteVideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [embedInput, setEmbedInput] = useState(embedUrl);

  const hasPreview = Boolean(fileUrl.trim() || embedUrl.trim());

  async function uploadFile(file: File) {
    setUploadError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mediaType", "video");

    try {
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(describeApiFailure(json, VIDEO_UPLOAD_FAILED_MESSAGE).display);
      }
      onFileUrlChange(json.url as string);
      onEmbedUrlChange("");
      setEmbedInput("");
    } catch (err) {
      setUploadError(friendlyErrorMessage(err, VIDEO_UPLOAD_FAILED_MESSAGE));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  function applyEmbedUrl() {
    const trimmed = embedInput.trim();
    if (!trimmed) return;
    if (!isValidVideoUrl(trimmed) && !parseEmbedVideoUrl(trimmed)) {
      setUploadError("Enter a valid MP4/WebM URL or YouTube/Vimeo link.");
      return;
    }
    setUploadError("");
    onEmbedUrlChange(trimmed);
    onFileUrlChange("");
  }

  const clearVideo = useCallback(() => {
    onFileUrlChange("");
    onEmbedUrlChange("");
    setEmbedInput("");
    setUploadError("");
  }, [onFileUrlChange, onEmbedUrlChange]);

  const previewEmbed = parseEmbedVideoUrl(embedUrl, embed);
  const previewFile = fileUrl.trim();
  const hasEmbedLink = Boolean(embedUrl.trim());

  return (
    <div className="space-y-3">
      {label && (
        <div>
          <p className="text-sm font-medium text-[var(--platform-text)]">{label}</p>
          {hint && (
            <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">{hint}</p>
          )}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragOver
            ? "border-[var(--platform-accent)] bg-[rgba(139,92,246,0.08)]"
            : "border-[var(--platform-border)] bg-[var(--platform-bg)]",
          uploading ? "pointer-events-none opacity-70" : "cursor-pointer",
        ].join(" ")}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-[var(--platform-accent)]" />
        ) : (
          <Film className="size-5 text-[var(--platform-accent)]" />
        )}
        <p className="text-xs text-[var(--platform-text-secondary)]">
          {uploading
            ? "Uploading…"
            : "Drag & drop MP4/WebM (max 50MB), click to upload, or paste YouTube/Vimeo below"}
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="platform-btn-ghost inline-flex items-center gap-2 text-xs"
        >
          <Upload className="size-3.5" />
          Upload video
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={embedInput}
          onChange={(e) => setEmbedInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyEmbedUrl();
            }
          }}
          placeholder="Or paste YouTube / Vimeo link"
          className="platform-input flex-1 text-sm"
        />
        <button type="button" onClick={applyEmbedUrl} className="platform-btn-ghost shrink-0 text-sm">
          Set link
        </button>
      </div>

      {uploadError && (
        <p
          role="alert"
          className="rounded-md border border-[var(--platform-error)]/30 bg-[rgba(220,38,38,0.06)] px-3 py-2 text-sm text-[var(--platform-error)]"
        >
          {uploadError}
        </p>
      )}

      {onDisplayChange && (
        <SiteVideoDisplayControls
          settings={display ?? {}}
          onChange={onDisplayChange}
          hideSize={hideDisplaySize}
        />
      )}

      {onEmbedChange && (
        <SiteVideoEmbedControls
          settings={embed ?? {}}
          onChange={onEmbedChange}
          show={hasEmbedLink}
        />
      )}

      {hasPreview && (
        <div
          className={[
            "group relative overflow-hidden rounded-md border border-[var(--platform-border)]",
            getVideoWrapperClassName(display),
          ].join(" ")}
        >
          <div className={getVideoFrameClassName(display, "bg-black")}>
            {previewEmbed ? (
              <iframe
                src={previewEmbed.embedUrl}
                title="Video preview"
                className={getVideoMediaClassName(display)}
                allow="autoplay; fullscreen"
              />
            ) : previewFile ? (
              <video
                src={previewFile}
                controls
                className={getVideoMediaClassName(display)}
                aria-label="Video preview"
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={clearVideo}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label="Remove video"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
