"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { isValidImageUrl, PLACEHOLDER_IMAGE } from "@/lib/data/vehicle-images";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";

type PreviewSize = "compact" | "large" | "category";

type SiteImageUploadProps = {
  label?: string;
  hint?: string;
  value: string;
  /** Last saved/committed image URL — used for revert. */
  savedValue?: string;
  onChange: (url: string) => void;
  uploadEndpoint?: string;
  /** Shown when value is empty (e.g. body-type stock photo). */
  defaultPreview?: string;
  /** Preview dimensions — category matches the storefront card (16:10). */
  previewSize?: PreviewSize;
  /** Optional label overlay on large/category previews. */
  previewLabel?: string;
};

function resolvedImageUrl(url: string): string {
  const normalized = normalizeMediaUrl(url);
  return isValidImageUrl(normalized) ? normalized : "";
}

export function SiteImageUpload({
  label,
  hint,
  value,
  savedValue,
  onChange,
  uploadEndpoint = "/api/admin/site-content/upload",
  defaultPreview,
  previewSize = "compact",
  previewLabel,
}: SiteImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const committedUrl = resolvedImageUrl(value);
  const inputPreviewUrl = urlInput.trim() ? resolvedImageUrl(urlInput) : "";
  const savedUrl = resolvedImageUrl(savedValue ?? "");
  const defaultUrl = resolvedImageUrl(defaultPreview ?? "");

  const previewUrl = inputPreviewUrl || committedUrl || defaultUrl;
  const showingDefault = !inputPreviewUrl && !committedUrl && Boolean(defaultUrl);
  const hasCustomImage = Boolean(inputPreviewUrl || committedUrl);
  const effectiveDraft = inputPreviewUrl || committedUrl;

  const hasDraftChange =
    effectiveDraft !== savedUrl ||
    (urlInput.trim() !== "" && inputPreviewUrl !== committedUrl);

  const canRevert = hasDraftChange && savedValue !== undefined;

  useEffect(() => {
    if (!urlInput.trim()) return;
    const normalizedInput = resolvedImageUrl(urlInput);
    if (normalizedInput && normalizedInput === committedUrl) {
      setUrlInput("");
    }
  }, [committedUrl, urlInput]);

  // Auto-commit valid URLs so "Save section" persists pasted/typed links without extra clicks.
  useEffect(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const normalized = resolvedImageUrl(trimmed);
    if (!normalized || normalized === committedUrl) return;

    const timer = window.setTimeout(() => {
      onChange(normalized);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [urlInput, committedUrl, onChange]);

  async function uploadFile(file: File) {
    setUploadError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "Upload failed");
      }
      setUrlInput("");
      onChange(json.url as string);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
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

  function commitUrlFromInput(raw?: string) {
    const trimmed = (raw ?? urlInput).trim();
    if (!trimmed) return;
    const normalized = resolvedImageUrl(trimmed);
    if (!normalized) return;
    onChange(normalized);
    setUrlInput("");
  }

  function handleUrlInputChange(next: string) {
    setUrlInput(next);
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;
    const normalized = resolvedImageUrl(pasted);
    if (!normalized) return;
    e.preventDefault();
    setUrlInput(pasted);
    onChange(normalized);
  }

  const clearImage = useCallback(() => {
    setUrlInput("");
    onChange("");
  }, [onChange]);

  const revertToSaved = useCallback(() => {
    setUrlInput("");
    onChange(savedValue ?? "");
  }, [onChange, savedValue]);

  const isStorefrontPreview = previewSize === "category" || previewSize === "large";
  const previewIsUnsaved =
    savedValue !== undefined && effectiveDraft !== savedUrl && Boolean(effectiveDraft || savedUrl);

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

      {previewUrl && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--platform-text-secondary)]">
              {showingDefault
                ? "Default preview (shown on site)"
                : previewIsUnsaved
                  ? "Preview (unsaved changes)"
                  : "Current image preview"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canRevert && (
                <button
                  type="button"
                  onClick={revertToSaved}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--platform-accent)] hover:underline"
                >
                  <RotateCcw className="size-3" />
                  Keep previous image
                </button>
              )}
              {hasCustomImage && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="text-xs text-[var(--platform-error)] hover:underline"
                >
                  Remove custom image
                </button>
              )}
            </div>
          </div>
          <div
            className={[
              "group relative overflow-hidden rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)]",
              previewIsUnsaved && "ring-2 ring-[var(--platform-accent)]/40",
              previewSize === "compact" && "inline-block",
              previewSize === "large" && "w-full max-w-sm aspect-[16/10]",
              previewSize === "category" && "w-full aspect-[16/10]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {/* Native <img> — admin must always see the asset being edited.
                Avoids next/image opacity-gate / cache races that left previews blank. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewUrl}
              src={previewUrl}
              alt={previewLabel || "Preview"}
              className={
                previewSize === "compact"
                  ? "h-32 w-full max-w-[20rem] object-cover sm:h-36"
                  : "absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              }
              onError={(e) => {
                const el = e.currentTarget;
                if (el.dataset.fallback === "1") return;
                el.dataset.fallback = "1";
                el.src = PLACEHOLDER_IMAGE;
              }}
            />
            {isStorefrontPreview && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            )}
            {isStorefrontPreview && previewLabel && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <p className="text-base font-semibold text-white">{previewLabel}</p>
                {showingDefault && (
                  <p className="mt-0.5 text-xs text-white/70">Stock photo for this body type</p>
                )}
              </div>
            )}
            {hasCustomImage && previewSize === "compact" && (
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove image"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {hasCustomImage && (
            <p className="truncate text-xs text-[var(--platform-text-secondary)]" title={previewUrl}>
              {previewUrl}
            </p>
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
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-[var(--platform-accent)]" />
        ) : (
          <ImagePlus className="size-5 text-[var(--platform-accent)]" />
        )}
        <p className="text-xs text-[var(--platform-text-secondary)]">
          {uploading ? "Uploading…" : "Drag & drop, click to upload, or paste URL below"}
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
          Upload
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => handleUrlInputChange(e.target.value)}
          onPaste={handleUrlPaste}
          onBlur={() => commitUrlFromInput()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitUrlFromInput();
            }
          }}
          placeholder="Or paste image URL — preview updates as you type"
          className="platform-input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={() => commitUrlFromInput()}
          disabled={!urlInput.trim() || !resolvedImageUrl(urlInput)}
          className="platform-btn-ghost shrink-0 text-sm disabled:opacity-50"
        >
          Set URL
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
    </div>
  );
}
