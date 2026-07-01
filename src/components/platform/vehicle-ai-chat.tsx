"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Copy, ImagePlus, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
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
  IMAGE_ADJUST_LABELS,
  type ImageAdjustPreset,
  isColorAdjustRequest,
  parseColorAdjustPreset,
} from "@/lib/ai/image-adjustments";
import { isPhotoRequest } from "@/lib/ai/photo-request";
import type {
  VehicleAiChatChanges,
  VehicleAiChatClientMessage,
  VehiclePhotoSource,
} from "@/lib/ai/vehicle-ai-chat-types";
import type { VehicleGalleryData, VehicleImageCategory } from "@/lib/types";
import { VEHICLE_GALLERY_ORDER } from "@/lib/types";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";

const QUICK_ACTIONS = [
  "Find stock photos (free)",
  "Edit description",
  "Warm up colors",
  "Increase contrast",
  "Improve the listing description",
  "Make the title sound more premium",
] as const;

const STOCK_PHOTOS_ACTION = "Find stock photos (free)";
const EDIT_DESCRIPTION_ACTION = "Edit description";

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
  onApplyFields: (fields: Partial<VehicleInput>) => void;
  onApplyGallery: (gallery: VehicleGalleryData) => void;
};

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

  async function uploadImageFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/vehicles/upload-image", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.message ?? "Upload failed");
    }
    return json.url as string;
  }

  function addImageToGallery(url: string, category: VehicleImageCategory = "exterior") {
    const next = { ...gallery };
    if (!next[category].includes(url)) {
      next[category] = [...next[category], url];
      onApplyGallery(next);
    }
    lastPastedImageUrlRef.current = url;
  }

  async function handlePastedOrDroppedFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;

    setError("");
    setUploadingImage(true);

    try {
      for (const file of list) {
        const url = await uploadImageFile(file);
        if (!url) continue;

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
            "Image added to gallery (exterior). Try “Warm up colors” or paste another photo. Color filters work without a Gemini key.",
          pastedImageUrl: url,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
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
      setError("Paste or upload a photo first, then try a color adjustment.");
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
        body: JSON.stringify({ url: targetUrl, preset }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "Could not adjust image");
      }

      const newUrl = json.url as string;
      const nextGallery = replaceGalleryUrl(gallery, targetUrl, newUrl);
      onApplyGallery(nextGallery);
      lastPastedImageUrlRef.current = newUrl;

      const assistantMsg: VehicleAiChatClientMessage = {
        id: newMessageId(),
        role: "assistant",
        content: colorAdjustReply(preset),
        applied: true,
        imageEditPreview: { before: targetUrl, after: newUrl, preset },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Color adjustment failed");
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
        body: JSON.stringify({ vehicle: form }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "Could not fetch stock photos");
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
      setError(err instanceof Error ? err.message : "Could not fetch stock photos");
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

    const colorPreset = parseColorAdjustPreset(trimmed);
    if (colorPreset || (trimmed !== EDIT_DESCRIPTION_ACTION && isColorAdjustRequest(trimmed))) {
      await handleColorAdjust(colorPreset ?? "vibrant", trimmed);
      return;
    }

    if (handleLocalGalleryCommand(trimmed)) {
      return;
    }

    if (trimmed === EDIT_DESCRIPTION_ACTION) {
      await sendGeminiMessage("Rewrite the listing description to be more compelling and premium. Keep it accurate to the vehicle specs.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed");
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
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, applied: true } : m))
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
      (m.proposedChanges || hasSuggestedImages(m.proposedImages))
  );

  function applyAllPending() {
    let nextForm = form;
    let nextGallery = gallery;

    for (const msg of messages) {
      if (msg.role !== "assistant" || msg.applied) continue;
      if (msg.proposedChanges) {
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
          (m.proposedChanges || hasSuggestedImages(m.proposedImages))
          ? { ...m, applied: true }
          : m
      )
    );
  }

  return (
    <aside
      ref={chatPanelRef}
      className={`platform-ai-chat${dragOver ? " platform-ai-chat--drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) {
          void handlePastedOrDroppedFiles(e.dataTransfer.files);
        }
      }}
    >
      <header className="platform-ai-chat-header">
        <Sparkles className="size-4 text-[var(--platform-ai-accent)]" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--platform-ai-text)]">AI Editor</h3>
          <p className="text-xs text-[var(--platform-ai-text-secondary)]">
            Chat to edit this listing
          </p>
          <p className="mt-1 text-[10px] leading-snug text-[var(--platform-ai-text-secondary)]">
            Free: stock photos, paste/drop images, color filters. Text edits need{" "}
            <code className="text-[10px]">GEMINI_API_KEY</code>.
          </p>
        </div>
      </header>

      {dragOver && (
        <div className="platform-ai-drop-overlay">
          <ImagePlus className="size-6" />
          <span>Drop image to add to gallery</span>
        </div>
      )}

      <div ref={scrollRef} className="platform-ai-chat-messages platform-scrollbar">
        {messages.length === 0 && !loading && (
          <div className="platform-ai-chat-empty">
            <p className="text-xs text-[var(--platform-ai-text-secondary)]">
              Paste (Ctrl+V) or drag photos here. Then try color chips below — no Gemini key
              required for filters.
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
                    <SafeVehicleImage
                      src={msg.imageEditPreview.before}
                      alt="Before"
                      fill={false}
                      width={72}
                      height={72}
                      className="size-16 rounded border border-[var(--platform-ai-border)] object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] text-[var(--platform-ai-text-secondary)]">
                      After (filter)
                    </p>
                    <SafeVehicleImage
                      src={msg.imageEditPreview.after}
                      alt="After"
                      fill={false}
                      width={72}
                      height={72}
                      className="size-16 rounded border border-[var(--platform-ai-accent)] object-cover"
                    />
                  </div>
                </div>
              )}

              {msg.role === "assistant" && msg.proposedChanges && !msg.applied && (
                <>
                  <ChangePreview
                    changes={msg.proposedChanges}
                    currentGallery={gallery}
                  />
                  <button
                    type="button"
                    onClick={() => applyChanges(msg.proposedChanges!, msg.id)}
                    className="platform-ai-apply-btn mt-2 w-full"
                  >
                    Apply changes
                  </button>
                </>
              )}

              {msg.role === "assistant" &&
                hasSuggestedImages(msg.proposedImages) &&
                !msg.applied && (
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

              {msg.applied && !msg.addedToGallery && (
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
            Stock photos, paste/drop uploads, and color filters still work without it.{" "}
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

      {hasPendingChanges && (
        <button type="button" onClick={applyAllPending} className="platform-ai-apply-btn mx-3 mb-2 w-[calc(100%-1.5rem)]">
          Apply all pending changes
        </button>
      )}

      <div className="platform-ai-chat-suggestions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            disabled={loading || uploadingImage}
            onClick={() => void sendMessage(action)}
            className={`platform-ai-chip${
              action === STOCK_PHOTOS_ACTION ? " platform-ai-chip--primary" : ""
            }${
              (COLOR_ADJUST_CHIPS.some((c) => c.label === action) ? " platform-ai-chip--filter" : "")
            }`}
          >
            {action}
          </button>
        ))}
        {COLOR_ADJUST_CHIPS.filter(
          (c) => !QUICK_ACTIONS.includes(c.label as (typeof QUICK_ACTIONS)[number])
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

      <div className="platform-ai-chat-input-wrap">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading || uploadingImage}
          placeholder="Ask to edit, paste an image, or drop a photo…"
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
        Enter to send · Shift+Enter for new line · Ctrl+V to paste images
      </p>
    </aside>
  );
}
