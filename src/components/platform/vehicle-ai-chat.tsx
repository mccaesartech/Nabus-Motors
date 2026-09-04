"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Copy, Eraser, History, ImagePlus, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import {
  applyVehicleAiChanges,
  mergeGallery,
} from "@/lib/ai/vehicle-ai-chat";
import {
  parseGalleryCommand,
  pickDefaultEditImageUrl,
  replaceGalleryUrl,
} from "@/lib/ai/gallery-commands";
import {
  colorAdjustReply,
  ENHANCE_PHOTOS_4K_ACTION,
  IMAGE_ADJUST_LABELS,
  type ImageAdjustPreset,
  isColorAdjustRequest,
  isImageEnhanceRequest,
  parseColorAdjustPreset,
} from "@/lib/ai/image-adjustments";
import { isPhotoRequest } from "@/lib/ai/photo-request";
import type {
  VehicleAiChatChanges,
  VehicleAiChatClientMessage,
  VehiclePhotoSource,
} from "@/lib/ai/vehicle-ai-chat-types";
import {
  countGalleryPhotos,
  isSparseVehicleListing,
  selectVehicleAiQuickActions,
  type VehicleAiQuickAction,
} from "@/lib/ai/vehicle-ai-vision";
import type { VehicleGalleryData, VehicleImageCategory } from "@/lib/types";
import { VEHICLE_GALLERY_ORDER } from "@/lib/types";
import { PLACEHOLDER_IMAGE } from "@/lib/data/vehicle-images";
import { describeApiFailure, friendlyErrorMessage } from "@/lib/errors/client";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { mapWithConcurrency } from "@/lib/images/prepare-client-upload";
import { uploadVehicleImageFile, NON_VEHICLE_IMAGE_CODE } from "@/lib/images/upload-vehicle-image-client";
import { platformPath } from "@/lib/platform/paths";
import { cn } from "@/lib/utils";

const STOCK_PHOTOS_FAILED_MESSAGE = "Stock photo suggestions are unavailable right now. Try again.";

const STOCK_PHOTOS_ACTION = "Find stock photos (free)";
const EDIT_DESCRIPTION_ACTION = "Edit description";
const FILL_FROM_PHOTOS_ACTION = "Fill listing from photos";
const DETECT_COLOR_ACTION = "Detect exterior color from photos";
const CORRECT_FIELDS_ACTION = "Correct fields from photos";
const INSPECTION_ACTION = "Write inspection summary";
const WARRANTY_ACTION = "Draft warranty notes";
const IMPROVE_DESCRIPTION_ACTION = "Improve the listing description";
const PREMIUM_TITLE_ACTION = "Make the title sound more premium";

const COLOR_ADJUST_CHIPS: Array<{ label: string; preset: ImageAdjustPreset }> = [
  { label: IMAGE_ADJUST_LABELS.warm, preset: "warm" },
  { label: IMAGE_ADJUST_LABELS.contrast, preset: "contrast" },
  { label: IMAGE_ADJUST_LABELS.darken, preset: "darken" },
  { label: IMAGE_ADJUST_LABELS.brighten, preset: "brighten" },
  { label: IMAGE_ADJUST_LABELS.vibrant, preset: "vibrant" },
];

const FIELD_LABELS: Record<string, string> = {
  make: "Make",
  model: "Model",
  year: "Year",
  trim: "Trim",
  price: "List price",
  mileage: "Mileage (km)",
  fuel_type: "Fuel type",
  transmission: "Transmission",
  condition: "Condition",
  body_type: "Body type",
  location: "Location",
  engine_size: "Engine",
  color: "Color",
  vin: "VIN",
  description: "Description",
  featured: "Featured",
  status: "Status",
  inspection_summary: "Inspection summary",
  warranty_notes: "Warranty notes",
  drivetrain: "Drivetrain",
  horsepower: "Horsepower",
  range: "Range",
  seating_capacity: "Seating",
  appendToDescription: "Add to description",
  removeFromGallery: "Remove photos",
  replaceGallery: "Reorder gallery",
};

const CATEGORY_LABELS: Record<VehicleImageCategory, string> = {
  exterior: "Exterior",
  interior: "Interior",
  engine: "Engine",
  other: "Other",
};

type VehicleAiChatProps = {
  form: VehicleInput;
  gallery: VehicleGalleryData;
  slug?: string;
  vehicleId?: string;
  onApplyFields: (fields: Partial<VehicleInput>) => void;
  onApplyGallery: (gallery: VehicleGalleryData) => void;
};

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Native img for before/after thumbs — avoids Next/Image opacity gate + CDN races. */
function ChatCompareThumb({
  src,
  alt,
  accent = false,
  fallbackSrc,
}: {
  src: string;
  alt: string;
  accent?: boolean;
  /** Optional secondary URL if primary fails (e.g. data URL → storage URL). */
  fallbackSrc?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const triedFallback = useRef(false);
  const triedCacheBust = useRef(false);

  useEffect(() => {
    setFailed(false);
    setActiveSrc(src);
    triedFallback.current = false;
    triedCacheBust.current = false;
  }, [src, fallbackSrc]);

  const displaySrc = failed ? PLACEHOLDER_IMAGE : activeSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- chat compare thumbs need immediate, ungated display
    <img
      src={displaySrc}
      alt={alt}
      width={72}
      height={72}
      decoding="async"
      className={cn(
        "size-16 rounded border object-cover bg-[var(--platform-bg-secondary)]",
        accent
          ? "border-[var(--platform-ai-accent)]"
          : "border-[var(--platform-ai-border)]"
      )}
      onError={() => {
        if (failed) return;
        if (!triedFallback.current && fallbackSrc && activeSrc !== fallbackSrc) {
          triedFallback.current = true;
          setActiveSrc(fallbackSrc);
          return;
        }
        if (
          !triedCacheBust.current &&
          activeSrc.startsWith("http") &&
          !activeSrc.includes("_cb=")
        ) {
          triedCacheBust.current = true;
          const joiner = activeSrc.includes("?") ? "&" : "?";
          setActiveSrc(`${activeSrc}${joiner}_cb=${Date.now()}`);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

function MessageCopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore silently
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`platform-ai-copy-btn${copied ? " platform-ai-copy-btn--copied" : ""}`}
      aria-label={copied ? "Copied to clipboard" : "Copy message"}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    if (value.length > 120) return `${value.slice(0, 117)}…`;
    return value;
  }
  return String(value);
}

function ChangePreview({
  changes,
  currentGallery,
}: {
  changes: VehicleAiChatChanges;
  currentGallery: VehicleGalleryData;
}) {
  const { gallery: galleryPatch, appendToDescription, removeFromGallery, replaceGallery, ...fields } =
    changes;
  const fieldEntries = Object.entries(fields);

  return (
    <div className="platform-ai-changes">
      <p className="platform-ai-changes-title">Proposed changes</p>
      {fieldEntries.length > 0 && (
        <ul className="platform-ai-changes-list">
          {fieldEntries.map(([key, value]) => (
            <li key={key}>
              <span className="platform-ai-changes-key">{FIELD_LABELS[key] ?? key}</span>
              <span className="platform-ai-changes-arrow">→</span>
              <span className="platform-ai-changes-value">{formatValue(value)}</span>
            </li>
          ))}
        </ul>
      )}
      {appendToDescription && (
        <div className="platform-ai-changes-append">
          <span className="platform-ai-changes-key">Append to description</span>
          <p className="platform-ai-changes-append-text">{appendToDescription}</p>
        </div>
      )}
      {removeFromGallery && removeFromGallery.length > 0 && (
        <ul className="platform-ai-changes-list">
          <li>
            <span className="platform-ai-changes-key">Remove photos</span>
            <span className="platform-ai-changes-arrow">→</span>
            <span className="platform-ai-changes-value">
              {removeFromGallery.length} URL{removeFromGallery.length === 1 ? "" : "s"}
            </span>
          </li>
        </ul>
      )}
      {replaceGallery && (
        <ul className="platform-ai-changes-list">
          <li>
            <span className="platform-ai-changes-key">Gallery reorder</span>
            <span className="platform-ai-changes-arrow">→</span>
            <span className="platform-ai-changes-value">Updated photo order</span>
          </li>
        </ul>
      )}
      {galleryPatch && (
        <ul className="platform-ai-changes-list">
          {VEHICLE_GALLERY_ORDER.map((cat) => {
            const urls = galleryPatch[cat];
            if (!urls?.length) return null;
            const count = urls.length;
            const existing = currentGallery[cat].length;
            return (
              <li key={cat}>
                <span className="platform-ai-changes-key">{CATEGORY_LABELS[cat]} photos</span>
                <span className="platform-ai-changes-arrow">→</span>
                <span className="platform-ai-changes-value">
                  +{count} URL{count === 1 ? "" : "s"} ({existing} existing)
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {fieldEntries.length === 0 &&
        !appendToDescription &&
        !galleryPatch &&
        !removeFromGallery?.length &&
        !replaceGallery && (
        <p className="text-xs text-[var(--platform-ai-text-secondary)]">No field changes.</p>
      )}
    </div>
  );
}

function StockPhotoPreview({
  photos,
  gallery,
  photoSource,
  onAddAll,
  onAddOne,
  onRemovePhoto,
}: {
  photos: VehicleGalleryData;
  gallery: VehicleGalleryData;
  photoSource?: VehiclePhotoSource;
  onAddAll: () => void;
  onAddOne: (category: VehicleImageCategory, url: string) => void;
  onRemovePhoto: (category: VehicleImageCategory, url: string) => void;
}) {
  const total = VEHICLE_GALLERY_ORDER.reduce((n, k) => n + (photos[k]?.length ?? 0), 0);
  if (!total) return null;

  const sourceLabel =
    photoSource === "pexels" ? "Stock photos (free)" : "Stock photo suggestions";

  return (
    <div className="platform-ai-changes">
      <p className="platform-ai-changes-title">{sourceLabel}</p>
      <p className="mb-2 text-xs text-[var(--platform-ai-text-secondary)]">
        Placeholder stock images — not photos of your actual vehicle.
      </p>
      {VEHICLE_GALLERY_ORDER.map((category) => {
        const urls = photos[category];
        if (!urls?.length) return null;
        return (
          <div key={category} className="mb-2">
            <p className="text-xs font-medium text-[var(--platform-ai-text-secondary)]">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {urls.map((url) => {
                const added = gallery[category].includes(url);
                return (
                  <div
                    key={url}
                    className={`group relative size-12 overflow-hidden rounded border ${
                      added
                        ? "border-[var(--platform-ai-accent)] opacity-60"
                        : "border-[var(--platform-ai-border)]"
                    }`}
                  >
                    <SafeVehicleImage
                      src={url}
                      alt={`Suggested ${category}`}
                      fill={false}
                      width={48}
                      height={48}
                      className="size-12 object-cover"
                    />
                    {!added && (
                      <button
                        type="button"
                        onClick={() => onAddOne(category, url)}
                        className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Add
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(category, url)}
                      className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
                      aria-label={`Remove suggested ${category} photo`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <button type="button" onClick={onAddAll} className="platform-ai-apply-btn w-full">
        {total === 1 ? "Add suggested photo" : `Add all ${total} suggested photos`}
      </button>
    </div>
  );
}

export function VehicleAiChat({
  form,
  gallery,
  slug,
  vehicleId,
  onApplyFields,
  onApplyGallery,
}: VehicleAiChatProps) {
  const [messages, setMessages] = useState<VehicleAiChatClientMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingNonVehicle, setPendingNonVehicle] = useState<{
    file: File;
    message: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatPanelRef = useRef<HTMLElement>(null);
  const lastPastedImageUrlRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const currentVehicle = {
    ...form,
    gallery,
    slug,
  };

  async function uploadImageFile(
    file: File,
    options?: { confirmNonVehicle?: boolean }
  ): Promise<string | null> {
    const result = await uploadVehicleImageFile(file, options);
    if (!result.ok) {
      if (result.requiresConfirmation || result.code === NON_VEHICLE_IMAGE_CODE) {
        setPendingNonVehicle({
          file,
          message:
            result.reason ||
            result.message ||
            "This does not look like a vehicle photo.",
        });
        return null;
      }
      throw new Error(result.message);
    }
    return result.url;
  }

  function addImageToGallery(url: string, category: VehicleImageCategory = "exterior") {
    const next = { ...gallery };
    if (!next[category].includes(url)) {
      next[category] = [...next[category], url];
      onApplyGallery(next);
    }
    lastPastedImageUrlRef.current = url;
  }

  async function handlePastedOrDroppedFiles(
    files: FileList | File[],
    options?: { confirmNonVehicle?: boolean }
  ) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;

    setError("");
    setPendingNonVehicle(null);
    setUploadingImage(true);

    try {
      await mapWithConcurrency(list, 3, async (file) => {
        const url = await uploadImageFile(file, options);
        if (!url) return;

        addImageToGallery(url, "exterior");

        const userMsg: VehicleAiChatClientMessage = {
          id: newMessageId(),
          role: "user",
          content: "Pasted image",
          pastedImageUrl: url,
        };
        const assistantMsg: VehicleAiChatClientMessage = {
          id: newMessageId(),
          role: "assistant",
          content:
            "Image added to gallery (exterior). Next: tap “Fill listing from photos” for a full vision pass (make, model, year, trim, description, paint) — or “Detect exterior color from photos”. Color filters below work without Gemini.",
          pastedImageUrl: url,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      });
    } catch (err) {
      setError(friendlyErrorMessage(err, "That image could not be uploaded. Try again."));
    } finally {
      setUploadingImage(false);
      textareaRef.current?.focus();
    }
  }

  useEffect(() => {
    const panel = chatPanelRef.current;
    if (!panel) return;

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length) {
        e.preventDefault();
        void handlePastedOrDroppedFiles(imageFiles);
      }
    }

    panel.addEventListener("paste", onPaste);
    return () => panel.removeEventListener("paste", onPaste);
  });

  async function handleColorAdjust(preset: ImageAdjustPreset, userText: string) {
    const targetUrl = pickDefaultEditImageUrl(gallery, lastPastedImageUrlRef.current);
    if (!targetUrl) {
      setError(
        preset === "enhance"
          ? "Paste or upload a photo first, then try Enhance photos (4K)."
          : "Paste or upload a photo first, then try a color adjustment."
      );
      return;
    }

    setError("");
    setInput("");

    const userMsg: VehicleAiChatClientMessage = {
      id: newMessageId(),
      role: "user",
      content: userText.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/vehicles/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          preset,
          vehicleId: vehicleId ?? undefined,
          vehicleSlug: slug,
          make: form.make,
          model: form.model,
          year: form.year,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(
          json.message ?? (preset === "enhance" ? "Could not enhance image" : "Could not adjust image")
        );
      }

      const newUrl = json.url as string;
      const afterPreview =
        typeof json.previewDataUrl === "string" && json.previewDataUrl.startsWith("data:")
          ? (json.previewDataUrl as string)
          : undefined;
      // Propose only — do not mutate gallery until admin Approves.
      const proposedGallery = replaceGalleryUrl(gallery, targetUrl, newUrl);

      const assistantMsg: VehicleAiChatClientMessage = {
        id: newMessageId(),
        role: "assistant",
        content: colorAdjustReply(preset),
        proposedChanges: { replaceGallery: proposedGallery },
        imageEditPreview: {
          before: targetUrl,
          after: newUrl,
          afterPreview,
          preset,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : preset === "enhance"
            ? "Photo enhance failed"
            : "Color adjustment failed"
      );
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleLocalGalleryCommand(userText: string) {
    const parsed = parseGalleryCommand(userText, gallery);
    if (!parsed) return false;

    setError("");
    setInput("");

    const userMsg: VehicleAiChatClientMessage = {
      id: newMessageId(),
      role: "user",
      content: userText.trim(),
    };

    const hasChanges =
      parsed.changes.removeFromGallery?.length ||
      parsed.changes.replaceGallery ||
      parsed.changes.gallery;

    if (!hasChanges) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: newMessageId(), role: "assistant", content: parsed.reply },
      ]);
      return true;
    }

    const assistantMsg: VehicleAiChatClientMessage = {
      id: newMessageId(),
      role: "assistant",
      content: parsed.reply,
      proposedChanges: parsed.changes,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    return true;
  }

  async function fetchStockPhotos(userText: string) {
    if (!form.make?.trim() || !form.model?.trim()) {
      setError("Enter make and model first so we can suggest relevant stock photos.");
      return;
    }

    setError("");
    setNotConfigured(false);
    setInput("");

    const userMsg: VehicleAiChatClientMessage = {
      id: newMessageId(),
      role: "user",
      content: userText.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/vehicles/suggest-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle: form, vehicleId: vehicleId ?? undefined }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(describeApiFailure(json, STOCK_PHOTOS_FAILED_MESSAGE).display);
      }

      const assistantMsg: VehicleAiChatClientMessage = {
        id: newMessageId(),
        role: "assistant",
        content: json.disclaimer
          ? `Found ${VEHICLE_GALLERY_ORDER.reduce((n, k) => n + (json.photos?.[k]?.length ?? 0), 0)} stock placeholders for your ${form.year} ${form.make} ${form.model}.`
          : "Here are stock photo suggestions.",
        proposedImages: json.photos,
        photoSource: "pexels",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(friendlyErrorMessage(err, STOCK_PHOTOS_FAILED_MESSAGE));
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || uploadingImage) return;

    if (trimmed === STOCK_PHOTOS_ACTION || isPhotoRequest(trimmed)) {
      await fetchStockPhotos(trimmed);
      return;
    }

    // Quality / 4K enhance must short-circuit before Gemini listing-fill (and before color filters).
    if (trimmed === ENHANCE_PHOTOS_4K_ACTION || isImageEnhanceRequest(trimmed)) {
      await handleColorAdjust("enhance", trimmed);
      return;
    }

    const colorPreset = parseColorAdjustPreset(trimmed);
    if (colorPreset || (trimmed !== EDIT_DESCRIPTION_ACTION && isColorAdjustRequest(trimmed))) {
      await handleColorAdjust(colorPreset ?? "vibrant", trimmed);
      return;
    }

    if (handleLocalGalleryCommand(trimmed)) {
      return;
    }

    if (trimmed === EDIT_DESCRIPTION_ACTION || trimmed === IMPROVE_DESCRIPTION_ACTION) {
      await sendGeminiMessage(
        "Rewrite the listing description to be more compelling and premium for Ghana / West Africa buyers. Keep it accurate to the vehicle specs already on the form and visible in photos. Propose the full description field — staff will Apply."
      );
      return;
    }

    if (trimmed === PREMIUM_TITLE_ACTION) {
      await sendGeminiMessage(
        "Improve the listing copy so the vehicle sounds premium and trustworthy. Rewrite the description (and trim wording if helpful) without inventing specs, mileage, or price. Staff will Apply."
      );
      return;
    }

    if (trimmed === FILL_FROM_PHOTOS_ACTION) {
      await sendGeminiMessage(
        "Fill listing from photos. Analyze the listing photos as if the form were blank. Infer make, model, year, body type, trim cues, fuel type when clear, and draft a professional description plus a short inspection_summary when condition cues are visible. Exterior paint is detected separately from the photos — do not invent color from memory. Propose a complete changes object for every field you can confidently fill. State confidence. Staff must Apply."
      );
      return;
    }

    if (trimmed === CORRECT_FIELDS_ACTION) {
      await sendGeminiMessage(
        "Correct fields from photos. Compare current form labels against the listing photos. Override wrong make/model/year/body_type/trim/fuel_type. Keep correct fields unchanged. Explain each correction with confidence. Exterior paint is detected separately — do not invent color from form labels. Staff must Apply."
      );
      return;
    }

    if (trimmed === DETECT_COLOR_ACTION) {
      await sendGeminiMessage("Detect exterior color from photos");
      return;
    }

    if (trimmed === INSPECTION_ACTION) {
      await sendGeminiMessage(
        "Write a professional inspection_summary from the listing photos and known specs. Cover exterior, interior, and any clearly visible mechanical cues. Be honest about uncertainty. Do not invent damage. Staff must Apply."
      );
      return;
    }

    if (trimmed === WARRANTY_ACTION) {
      await sendGeminiMessage(
        "Draft professional warranty_notes suitable for Nabus Motors. Keep claims editable and avoid inventing specific legal durations unless already provided — use clear placeholders where needed. Staff must Apply."
      );
      return;
    }

    await sendGeminiMessage(trimmed);
  }

  async function sendGeminiMessage(trimmed: string) {
    setError("");
    setNotConfigured(false);
    setInput("");

    const userMsg: VehicleAiChatClientMessage = {
      id: newMessageId(),
      role: "user",
      content: trimmed,
    };

    const apiMessages = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/vehicles/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          currentVehicle,
          vehicleId: vehicleId ?? undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.configured === false) setNotConfigured(true);
        const detail =
          json.keyWarning && json.code === "INVALID_KEY"
            ? json.keyWarning
            : json.message ?? "AI request failed";
        throw new Error(detail);
      }

      const assistantMsg: VehicleAiChatClientMessage = {
        id: newMessageId(),
        role: "assistant",
        content: json.reply ?? "Done.",
        proposedChanges: json.changes,
        proposedImages: json.suggestedImages,
        photoSource: json.photoSource,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (json.visionFetchFailed) {
        setError(
          "Listing photos could not be loaded for vision analysis. Color was not taken from the form label — retry or re-upload photos."
        );
      }
    } catch (err) {
      setError(
        friendlyErrorMessage(err, "The AI assistant did not respond. Try again in a moment.")
      );
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function applyChanges(changes: VehicleAiChatChanges, messageId: string) {
    const { form: nextForm, gallery: nextGallery } = applyVehicleAiChanges(
      form,
      gallery,
      changes
    );
    onApplyFields(nextForm);
    onApplyGallery(nextGallery);

    const preview = messages.find((m) => m.id === messageId)?.imageEditPreview;
    if (preview?.after) {
      lastPastedImageUrlRef.current = preview.after;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, applied: true } : m))
    );
  }

  function applyImageEdit(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    const preview = msg?.imageEditPreview;
    if (!preview) return;

    // Re-apply before→after on the current gallery so later edits aren't wiped.
    const nextGallery = replaceGalleryUrl(gallery, preview.before, preview.after);
    onApplyGallery(nextGallery);
    lastPastedImageUrlRef.current = preview.after;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, applied: true } : m))
    );
  }

  function dismissProposal(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              applied: false,
              dismissed: true,
              proposedChanges: undefined,
              proposedImages: undefined,
            }
          : m
      )
    );
  }

  function collectAddedUrls(
    current: VehicleGalleryData,
    photos: VehicleGalleryData
  ): string[] {
    const added: string[] = [];
    for (const key of VEHICLE_GALLERY_ORDER) {
      for (const url of photos[key] ?? []) {
        if (!current[key].includes(url)) added.push(url);
      }
    }
    return added;
  }

  function applyImages(photos: VehicleGalleryData, messageId: string) {
    const addedUrls = collectAddedUrls(gallery, photos);
    const merged = mergeGallery(gallery, photos);
    onApplyGallery(merged);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              applied: true,
              addedToGallery: addedUrls.length ? { urls: addedUrls } : undefined,
              content:
                addedUrls.length > 0
                  ? `Added ${addedUrls.length} photo${addedUrls.length === 1 ? "" : "s"} to the gallery.`
                  : m.content,
            }
          : m
      )
    );
  }

  function applySingleStockPhoto(
    photos: VehicleGalleryData,
    messageId: string,
    category: VehicleImageCategory,
    url: string
  ) {
    const single: VehicleGalleryData = {
      exterior: [],
      interior: [],
      engine: [],
      other: [],
      [category]: [url],
    };
    const addedUrls = gallery[category].includes(url) ? [] : [url];
    const merged = mergeGallery(gallery, single);
    onApplyGallery(merged);

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const prevAdded = m.addedToGallery?.urls ?? [];
        const allAdded = [...prevAdded, ...addedUrls];
        return {
          ...m,
          addedToGallery: allAdded.length ? { urls: allAdded } : m.addedToGallery,
        };
      })
    );
  }

  function undoAddedPhotos(messageId: string, urls: string[]) {
    const next = { ...gallery };
    for (const key of VEHICLE_GALLERY_ORDER) {
      next[key] = next[key].filter((u) => !urls.includes(u));
    }
    onApplyGallery(next);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, addedToGallery: { urls, undone: true }, applied: false }
          : m
      )
    );
  }

  function removeSuggestedPhoto(
    messageId: string,
    category: VehicleImageCategory,
    url: string
  ) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.proposedImages) return m;
        const nextImages = { ...m.proposedImages };
        nextImages[category] = (nextImages[category] ?? []).filter((u) => u !== url);
        const hasAny = VEHICLE_GALLERY_ORDER.some((k) => (nextImages[k]?.length ?? 0) > 0);
        return { ...m, proposedImages: hasAny ? nextImages : undefined };
      })
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function hasSuggestedImages(photos: VehicleGalleryData | undefined): boolean {
    if (!photos) return false;
    return VEHICLE_GALLERY_ORDER.some((k) => (photos[k]?.length ?? 0) > 0);
  }

  const hasPendingChanges = messages.some(
    (m) =>
      m.role === "assistant" &&
      !m.applied &&
      !m.dismissed &&
      (m.proposedChanges ||
        hasSuggestedImages(m.proposedImages) ||
        Boolean(m.imageEditPreview))
  );

  const galleryPhotoCount = countGalleryPhotos(gallery);
  const quickActions: VehicleAiQuickAction[] = selectVehicleAiQuickActions({
    sparse: isSparseVehicleListing(form),
    hasGalleryPhotos: galleryPhotoCount > 0,
    hasDescription: Boolean(form.description?.trim() && form.description.trim().length > 40),
    hasInspection: Boolean(form.inspection_summary?.trim()),
    hasWarranty: Boolean(form.warranty_notes?.trim()),
  });

  function applyAllPending() {
    let nextForm = form;
    let nextGallery = gallery;

    for (const msg of messages) {
      if (msg.role !== "assistant" || msg.applied || msg.dismissed) continue;
      if (msg.imageEditPreview) {
        nextGallery = replaceGalleryUrl(
          nextGallery,
          msg.imageEditPreview.before,
          msg.imageEditPreview.after
        );
        lastPastedImageUrlRef.current = msg.imageEditPreview.after;
      } else if (msg.proposedChanges) {
        const result = applyVehicleAiChanges(nextForm, nextGallery, msg.proposedChanges);
        nextForm = result.form;
        nextGallery = result.gallery;
      }
      if (hasSuggestedImages(msg.proposedImages)) {
        nextGallery = mergeGallery(nextGallery, msg.proposedImages!);
      }
    }

    onApplyFields(nextForm);
    onApplyGallery(nextGallery);
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "assistant" &&
          !m.dismissed &&
          (m.proposedChanges ||
            hasSuggestedImages(m.proposedImages) ||
            Boolean(m.imageEditPreview))
          ? { ...m, applied: true }
          : m
      )
    );
  }

  return (
    <aside
      ref={chatPanelRef}
      className="platform-ai-chat"
      data-vehicle-image-zone="ai"
    >
      <header className="platform-ai-chat-header">
        <Sparkles className="size-4 shrink-0 text-[var(--platform-ai-accent)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--platform-ai-text)]">AI Editor</h3>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={
                  vehicleId
                    ? `${platformPath("inventory/ai-usage")}?vehicleId=${encodeURIComponent(vehicleId)}`
                    : platformPath("inventory/ai-usage")
                }
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--platform-ai-text-secondary)] hover:bg-[var(--platform-ai-border)]/40 hover:text-[var(--platform-ai-text)]"
                title="AI usage history"
              >
                <History className="size-3" />
                History
              </Link>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setError("");
                  }}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--platform-ai-text-secondary)] hover:bg-[var(--platform-ai-border)]/40 hover:text-[var(--platform-ai-text)]"
                  title="Clear this chat session (does not delete saved usage history)"
                >
                  <Eraser className="size-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-[var(--platform-ai-text-secondary)]">
            Expert vision + structured listing edits
          </p>
          <p className="mt-1 text-[10px] leading-snug text-[var(--platform-ai-text-secondary)]">
            Vision fill, color detection, inspection & warranty copy need{" "}
            <code className="text-[10px]">GEMINI_API_KEY</code>. Free without key: stock photos,
            paste/drop, color filters. Suggestions always require Apply.
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="platform-ai-chat-messages platform-scrollbar">
        {messages.length === 0 && !loading && (
          <div className="platform-ai-chat-empty">
            <p className="text-xs text-[var(--platform-ai-text-secondary)]">
              {galleryPhotoCount > 0
                ? 'Photos are ready. Use "Fill listing from photos" for a full vision pass (identity, description, inspection cues, paint) — then Apply what looks right.'
                : "Use the AI photo drop zone below (or Ctrl+V while this panel is focused), then run Fill listing from photos. Primary and gallery drops belong in those form sections, not here."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`platform-ai-message platform-ai-message--${msg.role}`}
          >
            <div
              className={`platform-ai-bubble platform-ai-bubble--${msg.role}${
                msg.applied ? " platform-ai-bubble--applied" : ""
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>

              {msg.pastedImageUrl && (
                <div className="mt-2 overflow-hidden rounded border border-[var(--platform-ai-border)]">
                  <SafeVehicleImage
                    src={msg.pastedImageUrl}
                    alt="Uploaded"
                    fill={false}
                    width={160}
                    height={96}
                    className="h-24 w-full object-cover"
                  />
                </div>
              )}

              {msg.imageEditPreview && (
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] text-[var(--platform-ai-text-secondary)]">Before</p>
                    <ChatCompareThumb src={msg.imageEditPreview.before} alt="Before" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] text-[var(--platform-ai-text-secondary)]">
                      {msg.imageEditPreview.preset === "enhance"
                        ? "After (enhanced)"
                        : "After (filter)"}
                    </p>
                    <ChatCompareThumb
                      src={
                        msg.imageEditPreview.afterPreview ?? msg.imageEditPreview.after
                      }
                      fallbackSrc={
                        msg.imageEditPreview.afterPreview
                          ? msg.imageEditPreview.after
                          : undefined
                      }
                      alt="After"
                      accent
                    />
                  </div>
                </div>
              )}

              {msg.role === "assistant" &&
                msg.imageEditPreview &&
                !msg.applied &&
                !msg.dismissed && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyImageEdit(msg.id)}
                      className="platform-ai-apply-btn flex-1"
                    >
                      {msg.imageEditPreview.preset === "enhance"
                        ? "Approve enhance"
                        : "Approve filter"}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissProposal(msg.id)}
                      className="platform-ai-undo-btn flex-1 justify-center"
                    >
                      Reject
                    </button>
                  </div>
                )}

              {msg.role === "assistant" &&
                msg.proposedChanges &&
                !msg.imageEditPreview &&
                !msg.applied &&
                !msg.dismissed && (
                <>
                  <ChangePreview
                    changes={msg.proposedChanges}
                    currentGallery={gallery}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyChanges(msg.proposedChanges!, msg.id)}
                      className="platform-ai-apply-btn flex-1"
                    >
                      Apply changes
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissProposal(msg.id)}
                      className="platform-ai-undo-btn flex-1 justify-center"
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}

              {msg.role === "assistant" &&
                hasSuggestedImages(msg.proposedImages) &&
                !msg.applied &&
                !msg.dismissed && (
                <StockPhotoPreview
                  photos={msg.proposedImages!}
                  gallery={gallery}
                  photoSource={msg.photoSource}
                  onAddAll={() => applyImages(msg.proposedImages!, msg.id)}
                  onAddOne={(category, url) =>
                    applySingleStockPhoto(msg.proposedImages!, msg.id, category, url)
                  }
                  onRemovePhoto={(category, url) =>
                    removeSuggestedPhoto(msg.id, category, url)
                  }
                />
              )}

              {msg.addedToGallery && msg.addedToGallery.urls.length > 0 && !msg.addedToGallery.undone && (
                <button
                  type="button"
                  onClick={() => undoAddedPhotos(msg.id, msg.addedToGallery!.urls)}
                  className="platform-ai-undo-btn mt-2"
                >
                  <RotateCcw className="size-3.5" />
                  Undo add ({msg.addedToGallery.urls.length})
                </button>
              )}

              {msg.addedToGallery?.undone && (
                <p className="mt-2 text-xs text-[var(--platform-ai-text-secondary)]">
                  Stock photos removed from gallery.
                </p>
              )}

              {msg.dismissed && (
                <p className="mt-2 text-xs text-[var(--platform-ai-text-secondary)]">
                  Rejected — not applied to the listing.
                </p>
              )}

              {msg.applied && !msg.addedToGallery && !msg.dismissed && (
                <p className="mt-2 text-xs font-medium text-[var(--platform-ai-accent)]">
                  {msg.imageEditPreview ? "Filter applied to gallery photo" : "Applied to form"}
                </p>
              )}
            </div>
            <MessageCopyButton content={msg.content} />
          </div>
        ))}

        {loading && (
          <div className="platform-ai-bubble platform-ai-bubble--assistant">
            <div className="platform-ai-typing" aria-label="AI is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {notConfigured && (
        <div className="platform-ai-chat-notice">
          <p className="font-medium">Gemini API key not configured</p>
          <p className="mt-1">
            Text and description edits need <code>GEMINI_API_KEY</code> in Vercel.{" "}
            Stock photos, paste/drop uploads, color filters, and photo enhance (4K) still work without it.{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Get a key
            </a>
            .
          </p>
        </div>
      )}

      {error && !notConfigured && (
        <p className="platform-ai-chat-error">{error}</p>
      )}

      {pendingNonVehicle && (
        <div className="mx-3 mb-2 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-medium text-[var(--platform-ai-text)]">
            This doesn&apos;t look like a vehicle photo
          </p>
          <p className="text-[10px] text-[var(--platform-ai-text-secondary)]">
            {pendingNonVehicle.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploadingImage}
              className="platform-ai-apply-btn text-xs"
              onClick={() => {
                const file = pendingNonVehicle.file;
                setPendingNonVehicle(null);
                void handlePastedOrDroppedFiles([file], { confirmNonVehicle: true });
              }}
            >
              This is intentional — upload anyway
            </button>
            <button
              type="button"
              disabled={uploadingImage}
              className="platform-ai-undo-btn"
              onClick={() => setPendingNonVehicle(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {hasPendingChanges && (
        <button type="button" onClick={applyAllPending} className="platform-ai-apply-btn mx-3 mb-2 w-[calc(100%-1.5rem)]">
          Apply all pending changes
        </button>
      )}

      <div className="platform-ai-chat-suggestions">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={loading || uploadingImage}
            onClick={() => void sendMessage(action)}
            className={`platform-ai-chip${
              action === STOCK_PHOTOS_ACTION ? " platform-ai-chip--primary" : ""
            }${
              action === FILL_FROM_PHOTOS_ACTION && galleryPhotoCount > 0
                ? " platform-ai-chip--primary"
                : ""
            }${
              action === ENHANCE_PHOTOS_4K_ACTION ||
              COLOR_ADJUST_CHIPS.some((c) => c.label === action)
                ? " platform-ai-chip--filter"
                : ""
            }`}
          >
            {action}
          </button>
        ))}
        {COLOR_ADJUST_CHIPS.filter(
          (c) => !quickActions.includes(c.label as VehicleAiQuickAction)
        ).map((chip) => (
          <button
            key={chip.preset}
            type="button"
            disabled={loading || uploadingImage}
            onClick={() => void handleColorAdjust(chip.preset, chip.label)}
            className="platform-ai-chip platform-ai-chip--filter"
            title="Adjust colors (filter) — works without Gemini"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div
        className={`platform-ai-photo-drop${dragOver ? " platform-ai-photo-drop--active" : ""}`}
        data-vehicle-image-zone="ai-drop"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (e.dataTransfer.files.length) {
            void handlePastedOrDroppedFiles(e.dataTransfer.files);
          }
        }}
      >
        <ImagePlus className="size-4 shrink-0" aria-hidden />
        <span>
          {uploadingImage
            ? "Uploading for AI…"
            : dragOver
              ? "Drop for AI analysis"
              : "Drop photos here for AI only (not primary)"}
        </span>
      </div>

      <div className="platform-ai-chat-input-wrap">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading || uploadingImage}
          placeholder="Fill from photos, correct fields, inspection, warranty…"
          className="platform-ai-chat-input"
          aria-label="Message AI editor"
        />
        <button
          type="button"
          disabled={loading || uploadingImage || !input.trim()}
          onClick={() => void sendMessage(input)}
          className="platform-ai-chat-send"
          aria-label="Send message"
        >
          {loading || uploadingImage ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
      <p className="platform-ai-chat-hint">
        Enter to send · Shift+Enter for new line · Ctrl+V pastes into AI only when this panel is focused
      </p>
    </aside>
  );
}
