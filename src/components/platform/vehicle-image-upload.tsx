"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { isValidImageUrl } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";

type VehicleImageUploadProps = {
  label?: string;
  hint?: string;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
};

export function VehicleImageUpload({
  label,
  hint,
  urls,
  onUrlsChange,
}: VehicleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const previewUrls = urls.filter(isValidImageUrl);

  const appendUrl = useCallback(
    (url: string) => {
      if (!isValidImageUrl(url) || urls.includes(url)) return;
      onUrlsChange([...urls, url]);
    },
    [urls, onUrlsChange]
  );

  const removeUrl = useCallback(
    (url: string) => {
      onUrlsChange(urls.filter((u) => u !== url));
    },
    [urls, onUrlsChange]
  );

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploadError("");
    setUploading(true);
    const nextUrls = [...urls];

    for (const file of list) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/admin/vehicles/upload-image", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.message ?? "Upload failed");
        }
        const url = json.url as string;
        if (isValidImageUrl(url) && !nextUrls.includes(url)) {
          nextUrls.push(url);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        break;
      }
    }

    onUrlsChange(nextUrls);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) void uploadFiles(files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
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
          multiple
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
            {uploading ? "Uploading…" : "Drag & drop or click to upload"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
            JPEG, PNG, or WebP · max 5MB each
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

      {uploadError && (
        <p
          role="alert"
          className="rounded-md border border-[var(--platform-error)]/30 bg-[rgba(220,38,38,0.06)] px-3 py-2 text-sm text-[var(--platform-error)]"
        >
          {uploadError}
        </p>
      )}

      {previewUrls.length > 0 && (
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
      )}
    </div>
  );
}
