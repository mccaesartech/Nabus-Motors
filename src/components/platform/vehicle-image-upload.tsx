"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ImagePlus,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { isValidImageUrl } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { mapWithConcurrency } from "@/lib/images/prepare-client-upload";
import { uploadVehicleImageFile } from "@/lib/images/upload-vehicle-image-client";

const UPLOAD_CONCURRENCY = 3;

type VehicleImageUploadProps = {
  label?: string;
  hint?: string;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  maxImages?: number;
  reorderable?: boolean;
};

export function VehicleImageUpload({
  label,
  hint,
  urls,
  onUrlsChange,
  maxImages,
  reorderable = false,
}: VehicleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const previewUrls = urls.filter(isValidImageUrl);
  const atLimit = maxImages !== undefined && previewUrls.length >= maxImages;
  const isPrimarySlot = maxImages === 1;
  const primaryPreviewUrl = isPrimarySlot ? previewUrls[0] ?? null : null;

  const appendUrl = useCallback(
    (url: string) => {
      if (!isValidImageUrl(url) || urls.includes(url)) return;
      if (maxImages === 1) {
        onUrlsChange([url]);
        return;
      }
      if (atLimit) return;
      onUrlsChange([...urls, url]);
    },
    [urls, onUrlsChange, maxImages, atLimit]
  );

  const removeUrl = useCallback(
    (url: string) => {
      onUrlsChange(urls.filter((u) => u !== url));
    },
    [urls, onUrlsChange]
  );

  const moveUrl = useCallback(
    (index: number, direction: -1 | 1) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= previewUrls.length) return;
      const next = [...previewUrls];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      onUrlsChange(next);
    },
    [previewUrls, onUrlsChange]
  );

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0 || atLimit) return;

    const room =
      maxImages === undefined
        ? list.length
        : maxImages === 1
          ? 1
          : Math.max(0, maxImages - previewUrls.length);
    const batch = list.slice(0, room);
    if (batch.length === 0) return;

    setUploadError("");
    setUploading(true);
    setUploadProgress({ done: 0, total: batch.length });

    let nextUrls = [...previewUrls];
    let done = 0;
    let firstError = "";

    const commit = () => onUrlsChange([...nextUrls]);

    await mapWithConcurrency(batch, UPLOAD_CONCURRENCY, async (file) => {
      if (maxImages !== undefined && maxImages !== 1 && nextUrls.length >= maxImages) {
        return;
      }

      const result = await uploadVehicleImageFile(file);
      done += 1;
      setUploadProgress({ done, total: batch.length });

      if (!result.ok) {
        if (!firstError) firstError = result.message;
        return;
      }

      const url = result.url;
      if (!isValidImageUrl(url)) return;

      if (maxImages === 1) {
        nextUrls = [url];
      } else if (!nextUrls.includes(url)) {
        if (maxImages !== undefined && nextUrls.length >= maxImages) return;
        nextUrls.push(url);
      }
      commit();
    });

    if (firstError) setUploadError(firstError);
    setUploading(false);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading || atLimit) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) void uploadFiles(files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!atLimit) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function addUrlFromInput() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    appendUrl(trimmed);
    setUrlInput("");
  }

  const uploadingLabel =
    uploadProgress && uploadProgress.total > 1
      ? `Uploading ${uploadProgress.done} of ${uploadProgress.total}…`
      : "Uploading…";

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

      {!atLimit && (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
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
              multiple={maxImages !== 1}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
              }}
            />
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-[var(--platform-accent)]" />
            ) : (
              <ImagePlus className="size-6 text-[var(--platform-accent)]" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--platform-text)]">
                {uploading ? uploadingLabel : "Drag & drop or click to upload"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
                JPEG, PNG, or WebP · max 5MB each · large photos are compressed before upload
                {maxImages === 1 ? " · 1 image only" : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="platform-btn-ghost inline-flex items-center gap-2 text-sm"
            >
              <Upload className="size-4" />
              Upload
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrlFromInput();
                }
              }}
              placeholder="Or paste image URL"
              className="platform-input flex-1 text-sm"
            />
            <button
              type="button"
              onClick={addUrlFromInput}
              className="platform-btn-ghost shrink-0 text-sm"
            >
              Add URL
            </button>
          </div>
        </>
      )}

      {uploadError && (
        <p
          role="alert"
          className="rounded-md border border-[var(--platform-error)]/30 bg-[rgba(220,38,38,0.06)] px-3 py-2 text-sm text-[var(--platform-error)]"
        >
          {uploadError}
        </p>
      )}

      {primaryPreviewUrl ? (
        <div className="space-y-2">
          <div className="group relative overflow-hidden rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)]">
            <button
              type="button"
              onClick={() => setLightboxUrl(primaryPreviewUrl)}
              className="relative block aspect-[16/10] w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-accent)] focus-visible:ring-inset"
              aria-label="View primary image fullscreen"
            >
              <SafeVehicleImage
                src={primaryPreviewUrl}
                alt="Primary listing photo"
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 640px"
              />
              <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                <Expand className="size-3.5" aria-hidden />
                View primary
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeUrl(primaryPreviewUrl)}
              className="absolute right-2 top-2 z-[1] flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition-opacity hover:opacity-100 group-hover:opacity-100"
              aria-label="Remove primary image"
            >
              <X className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLightboxUrl(primaryPreviewUrl)}
            className="platform-btn-ghost inline-flex items-center gap-2 text-sm"
          >
            <Expand className="size-4" />
            View primary
          </button>
        </div>
      ) : previewUrls.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {previewUrls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative size-24 overflow-hidden rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)]"
            >
              <SafeVehicleImage
                src={url}
                alt={`Photo ${i + 1}`}
                fill={false}
                width={96}
                height={96}
                className="size-24 object-cover"
              />
              {reorderable && previewUrls.length > 1 && (
                <div className="absolute bottom-1 left-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveUrl(i, -1)}
                    className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-40"
                    aria-label={`Move image ${i + 1} earlier`}
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={i === previewUrls.length - 1}
                    onClick={() => moveUrl(i, 1)}
                    className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-40"
                    aria-label={`Move image ${i + 1} later`}
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeUrl(url)}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Remove image ${i + 1}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {lightboxUrl && (
        <PrimaryImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}

function PrimaryImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [backdropArmed, setBackdropArmed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const armTimer = window.setTimeout(() => setBackdropArmed(true), 120);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(armTimer);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Primary image preview"
      className="fixed inset-0 z-[200] bg-black/90 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      onClick={() => {
        if (backdropArmed) onClose();
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div
          className="relative max-h-full max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <SafeVehicleImage
            src={url}
            alt="Primary listing photo"
            fill={false}
            width={1600}
            height={1000}
            className="max-h-[min(90vh,900px)] w-auto max-w-[min(96vw,1200px)] object-contain"
            sizes="100vw"
            priority
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 sm:px-4">
        <p className="truncate text-sm font-medium text-white drop-shadow-sm">Primary image</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close primary image preview"
          className="pointer-events-auto flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white text-black shadow-md transition-[transform,background-color] duration-200 touch-manipulation hover:bg-white/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <p className="sr-only">Press Escape to close.</p>
    </div>,
    document.body
  );
}
