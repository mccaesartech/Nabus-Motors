"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

type ProfileAvatarViewerProps = {
  avatarUrl: string | null;
  hasUploadedAvatar: boolean;
  initials: string;
  /** Visual size of the clickable avatar in the page. */
  size?: "md" | "lg";
  getAccessToken: () => Promise<string | null>;
  onAvatarChange?: (next: {
    avatarUrl: string | null;
    hasUploadedAvatar: boolean;
  }) => void | Promise<void>;
  onError?: (message: string) => void;
  onMessage?: (message: string) => void;
  className?: string;
};

function isAllowedImageFile(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return Boolean(ext && ALLOWED_EXT.has(ext));
}

function fileFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  const fromItems = Array.from(dt.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .find((file): file is File => Boolean(file));
  if (fromItems) return fromItems;
  return dt.files?.[0] ?? null;
}

export function ProfileAvatarViewer({
  avatarUrl,
  hasUploadedAvatar,
  initials,
  size = "lg",
  getAccessToken,
  onAvatarChange,
  onError,
  onMessage,
  className,
}: ProfileAvatarViewerProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const overlayDragDepthRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [dragOverTrigger, setDragOverTrigger] = useState(false);
  const [dragOverOverlay, setDragOverOverlay] = useState(false);

  useEffect(() => {
    if (!open) {
      setViewerError("");
      setDragOverOverlay(false);
      overlayDragDepthRef.current = 0;
    }
  }, [open]);

  function reportError(msg: string) {
    setViewerError(msg);
    onError?.(msg);
  }

  function validateAndUpload(file: File | null) {
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      reportError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      reportError("Photo is too large. Maximum size is 2MB.");
      return;
    }
    void uploadPhoto(file);
  }

  async function uploadPhoto(file: File) {
    setViewerError("");
    onError?.("");
    setBusy(true);

    const token = await getAccessToken();
    if (!token) {
      const msg = "Your session expired. Please sign in again.";
      reportError(msg);
      setBusy(false);
      return;
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/customer/profile/avatar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const msg = body?.message || "Could not update your photo.";
      reportError(msg);
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const nextUrl = (body.avatar_url as string | null) ?? null;
    await onAvatarChange?.({ avatarUrl: nextUrl, hasUploadedAvatar: true });
    const msg = body.message || "Profile photo updated.";
    onMessage?.(msg);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removePhoto() {
    setViewerError("");
    onError?.("");
    setBusy(true);

    const token = await getAccessToken();
    if (!token) {
      const msg = "Your session expired. Please sign in again.";
      reportError(msg);
      setBusy(false);
      return;
    }

    const res = await fetch("/api/customer/profile/avatar", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const msg = body?.message || "Could not remove your photo.";
      reportError(msg);
      setBusy(false);
      return;
    }

    const nextUrl = (body.avatar_url as string | null) ?? null;
    await onAvatarChange?.({
      avatarUrl: nextUrl,
      hasUploadedAvatar: false,
    });
    const msg = body.message || "Profile photo removed.";
    onMessage?.(msg);
    setBusy(false);
  }

  function onDragEnterTrigger(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    dragDepthRef.current += 1;
    setDragOverTrigger(true);
  }

  function onDragOverTrigger(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeaveTrigger(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOverTrigger(false);
  }

  function onDropTrigger(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragOverTrigger(false);
    if (busy) return;
    validateAndUpload(fileFromDataTransfer(e.dataTransfer));
  }

  function onDragEnterOverlay(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    overlayDragDepthRef.current += 1;
    setDragOverOverlay(true);
  }

  function onDragOverOverlay(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeaveOverlay(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    overlayDragDepthRef.current = Math.max(0, overlayDragDepthRef.current - 1);
    if (overlayDragDepthRef.current === 0) setDragOverOverlay(false);
  }

  function onDropOverlay(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    overlayDragDepthRef.current = 0;
    setDragOverOverlay(false);
    if (busy) return;
    validateAndUpload(fileFromDataTransfer(e.dataTransfer));
  }

  const sizeClass = size === "md" ? "size-16 text-lg" : "size-20 text-xl";

  return (
    <>
      <button
        type="button"
        className={cn(
          "group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-purple/20 bg-brand-purple/10 font-semibold text-brand-purple outline-none transition hover:border-brand-purple/40 focus-visible:ring-3 focus-visible:ring-ring/50",
          sizeClass,
          dragOverTrigger &&
            "border-brand-purple ring-3 ring-brand-purple/35 border-dashed scale-[1.03]",
          className
        )}
        aria-label={avatarUrl ? "View and edit profile photo" : "Add profile photo"}
        onClick={() => setOpen(true)}
        onDragEnter={onDragEnterTrigger}
        onDragOver={onDragOverTrigger}
        onDragLeave={onDragLeaveTrigger}
        onDrop={onDropTrigger}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center bg-[#1a0b2e]/70 py-1 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100",
            dragOverTrigger && "opacity-100"
          )}
        >
          <Camera className="size-3.5 text-white" aria-hidden />
        </span>
        {dragOverTrigger ? (
          <span className="absolute inset-0 flex items-center justify-center bg-brand-purple/55 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
            Drop
          </span>
        ) : null}
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-[#0c0618] p-0 text-white ring-0 duration-150 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
          aria-labelledby={titleId}
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={() => setOpen(false)}
              aria-label="Close profile photo"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <DialogTitle
                id={titleId}
                className="truncate font-heading text-base font-semibold text-white"
              >
                Profile photo
              </DialogTitle>
              <DialogDescription className="sr-only">
                View your profile photo. Change or remove it from this screen.
                You can also drag and drop a new photo onto the preview.
              </DialogDescription>
            </div>
          </div>

          <div
            className={cn(
              "relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 transition-colors",
              dragOverOverlay && "bg-brand-purple/20"
            )}
            onDragEnter={onDragEnterOverlay}
            onDragOver={onDragOverOverlay}
            onDragLeave={onDragLeaveOverlay}
            onDrop={onDropOverlay}
          >
            <div
              className={cn(
                "relative flex size-[min(72vw,22rem)] max-h-[min(58vh,22rem)] items-center justify-center overflow-hidden rounded-full border border-white/15 bg-brand-purple/20 text-5xl font-semibold text-brand-lavender shadow-[0_0_0_1px_rgba(139,92,246,0.15)] transition sm:text-6xl",
                dragOverOverlay &&
                  "border-dashed border-brand-lavender/80 ring-4 ring-brand-lavender/30 scale-[1.02]"
              )}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Your profile photo"
                  className="size-full object-cover"
                />
              ) : (
                <span aria-hidden>{initials}</span>
              )}
              {dragOverOverlay ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1a0b2e]/75 px-4 text-center">
                  <ImagePlus className="size-8 text-brand-lavender" aria-hidden />
                  <span className="text-sm font-medium text-white">Drop to update photo</span>
                </span>
              ) : null}
            </div>

            {busy ? (
              <p className="mt-6 text-sm text-white/70" role="status" aria-live="polite">
                Updating photo…
              </p>
            ) : dragOverOverlay ? (
              <p className="mt-6 text-sm text-brand-lavender" role="status" aria-live="polite">
                Release to upload
              </p>
            ) : (
              <p className="mt-6 hidden text-sm text-white/45 sm:block">
                Drag and drop a photo here, or use Change photo below.
              </p>
            )}
            {viewerError ? (
              <p className="mt-4 max-w-md text-center text-sm text-red-300" role="alert">
                {viewerError}
              </p>
            ) : null}
          </div>

          <div className="border-t border-white/10 bg-[#140a24]/90 px-4 py-4 sm:px-6">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => validateAndUpload(e.target.files?.[0] ?? null)}
            />
            <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                className="min-h-11 flex-1 border-white/25 bg-white/5 text-white hover:border-white/40 hover:bg-white/10 hover:text-white sm:flex-none sm:min-w-44"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {hasUploadedAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  className="min-h-11 flex-1 text-red-300 hover:bg-red-500/15 hover:text-red-200 sm:flex-none sm:min-w-36"
                  onClick={() => void removePhoto()}
                >
                  <Trash2 className="size-4" />
                  Remove photo
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-center text-xs text-white/50">
              JPEG, PNG, or WebP up to 2MB. On desktop you can drag and drop onto the photo.
              {!hasUploadedAvatar && avatarUrl
                ? " Showing your Google photo until you upload your own."
                : null}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}