"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Palette, Save, XCircle } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { SiteImageUpload } from "@/components/platform/site-image-upload";
import { SiteVideoUpload } from "@/components/platform/site-video-upload";
import { CorporateContentEditors } from "@/components/platform/corporate-content-editors";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  adminErrorMessage,
  isAdminAuthError,
  parseAdminResponse,
  redirectToAdminLogin,
} from "@/lib/admin/client";
import {
  DEFAULT_SITE_CONTENT,
  type SiteContent,
  type SiteContentCard,
  type BrowseByCategoryCard,
  type TestimonialSiteContentItem,
  type SiteContentSection,
} from "@/lib/site-content/defaults";
import { SITE_CONTENT_ICON_NAMES } from "@/lib/site-content-icons";
import { categoryPhotoUrlFor } from "@/lib/data/vehicle-images";
import { resolveTestimonialImage } from "@/lib/site-content/media-url";

type TabDef = { id: SiteContentSection; label: string; preview?: string };

const TAB_GROUPS: { label: string; tabs: TabDef[] }[] = [
  {
    label: "Corporate",
    tabs: [
      { id: "corporateHomepage", label: "Corp. Homepage", preview: "/" },
      {
        id: "startYourJourney",
        label: "How Can We Help",
        preview: "/",
      },
      { id: "corporateServices", label: "Corp. Services", preview: "/" },
      { id: "corporateStats", label: "Corp. Stats", preview: "/" },
      { id: "corporateFaq", label: "Corp. FAQ", preview: "/" },
      { id: "corporateTestimonials", label: "Corp. Testimonials", preview: "/" },
      { id: "corporateServicesPage", label: "Services Page", preview: "/services" },
      { id: "whyChooseUs", label: "Why Choose Us", preview: "/" },
      { id: "about", label: "About", preview: "/about" },
    ],
  },
  {
    label: "Auto",
    tabs: [
      { id: "homepage", label: "Auto Homepage", preview: "/auto" },
      { id: "corporateDivisions", label: "Auto Divisions", preview: "/auto" },
      { id: "browseByCategory", label: "Browse by Category", preview: "/auto" },
      { id: "testimonials", label: "Auto Testimonials", preview: "/auto" },
      { id: "inventoryPage", label: "Inventory Page", preview: "/auto/inventory" },
      { id: "sparePartsLanding", label: "Spare Parts", preview: "/auto/spare-parts" },
      { id: "buy", label: "Buy", preview: "/auto/buy" },
      { id: "sell", label: "Sell", preview: "/auto/sell" },
      { id: "financing", label: "Financing", preview: "/auto/financing" },
      { id: "header", label: "Auto Header", preview: "/auto" },
    ],
  },
  {
    label: "Freight",
    tabs: [
      { id: "freightLanding", label: "Freight Page", preview: "/freight-forwarding" },
      { id: "shippingConsultation", label: "Shipping Consult.", preview: "/shipping-consultation" },
      { id: "freightTracking", label: "Tracking Page", preview: "/freight-forwarding/tracking" },
    ],
  },
  {
    label: "Global",
    tabs: [
      { id: "global", label: "Global" },
      { id: "footer", label: "Footer", preview: "/" },
      { id: "contact", label: "Contact", preview: "/contact" },
    ],
  },
];

const TABS: TabDef[] = TAB_GROUPS.flatMap((group) => group.tabs);

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-[var(--platform-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="platform-input w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      className="platform-input w-full resize-y"
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function formatSavedAt(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

type SectionSaveState = {
  status: "idle" | "saving" | "success" | "error";
  savedAt?: Date;
  message?: string;
};

function SaveSectionBar({
  label,
  saving,
  saveState,
  onSave,
}: {
  label: string;
  saving: boolean;
  saveState: SectionSaveState;
  onSave: () => void;
}) {
  const justSaved = saveState.status === "success" && Boolean(saveState.savedAt);
  const hasError = saveState.status === "error";

  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--platform-border)] bg-[var(--platform-card)] px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-[var(--platform-text-secondary)]">
          Save changes to <span className="font-medium text-[var(--platform-text)]">{label}</span>
        </p>
        {justSaved && (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--platform-success)]">
            <CheckCircle2 className="size-4 shrink-0" />
            Saved at {formatSavedAt(saveState.savedAt!)}
          </p>
        )}
        {hasError && saveState.message && (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--platform-error)]">
            <XCircle className="size-4 shrink-0" />
            {saveState.message}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={saving || justSaved}
        onClick={onSave}
        className={[
          "platform-btn-primary inline-flex items-center gap-2",
          justSaved && "bg-[var(--platform-success)] hover:bg-[var(--platform-success)]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {saving ? (
          <>
            <Save className="size-4 animate-pulse" />
            Saving…
          </>
        ) : justSaved ? (
          <>
            <CheckCircle2 className="size-4" />
            Saved
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save section
          </>
        )}
      </button>
    </div>
  );
}

export default function SiteContentPage() {
  const router = useRouter();
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [activeTab, setActiveTab] = useState<SiteContentSection>("corporateHomepage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastIsError, setToastIsError] = useState(false);
  const [loadWarning, setLoadWarning] = useState("");
  const [savedContent, setSavedContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [sectionSaveState, setSectionSaveState] = useState<SectionSaveState>({
    status: "idle",
  });
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/site-content");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    if (json.content) {
      setContent(json.content);
      setSavedContent(json.content);
    }
    setLoadWarning(typeof json.message === "string" ? json.message : "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSectionSaveState({ status: "idle" });
  }, [activeTab]);

  function updateSection<K extends SiteContentSection>(
    section: K,
    updater: (prev: SiteContent[K]) => SiteContent[K]
  ) {
    setContent((prev) => ({ ...prev, [section]: updater(prev[section]) }));
  }

  async function saveSection(section: SiteContentSection) {
    setSaving(true);
    setSectionSaveState({ status: "saving" });
    const sectionContent = contentRef.current[section];
    const res = await fetch("/api/admin/site-content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ section, content: sectionContent }),
    });
    const json = await parseAdminResponse(res);
    setSaving(false);
    if (isAdminAuthError(res)) {
      redirectToAdminLogin(router);
      const message = adminErrorMessage(json, "Session expired. Please sign in again.");
      setToast(message);
      setToastIsError(true);
      setSectionSaveState({ status: "error", message });
      return;
    }
    if (res.ok && json.ok) {
      const saved = json.content as Partial<SiteContent> | undefined;
      if (saved?.[section]) {
        setContent((prev) => ({
          ...prev,
          [section]: saved[section] as SiteContent[typeof section],
        }));
        setSavedContent((prev) => ({
          ...prev,
          [section]: saved[section] as SiteContent[typeof section],
        }));
      }
      const label = TABS.find((t) => t.id === section)?.label ?? section;
      const savedAt = new Date();
      const message = `${label} saved successfully at ${formatSavedAt(savedAt)}.`;
      setToast(message);
      setToastIsError(false);
      setSectionSaveState({ status: "success", savedAt });
      setTimeout(() => {
        setToast("");
        setSectionSaveState((prev) =>
          prev.status === "success" ? { status: "idle", savedAt: prev.savedAt } : prev
        );
      }, 5000);
    } else {
      const message = adminErrorMessage(json, "Failed to save content.");
      setToast(message);
      setToastIsError(true);
      setSectionSaveState({ status: "error", message });
    }
  }

  function updateWhyChooseCard(index: number, field: keyof SiteContentCard, value: string) {
    updateSection("whyChooseUs", (prev) => {
      const cards = [...prev.cards];
      cards[index] = { ...cards[index], [field]: value };
      return { ...prev, cards };
    });
  }

  function updateAboutValue(index: number, field: keyof SiteContentCard, value: string) {
    updateSection("about", (prev) => {
      const values = [...prev.values];
      values[index] = { ...values[index], [field]: value };
      return { ...prev, values };
    });
  }

  function updateBrowseCategoryCard(
    index: number,
    field: keyof BrowseByCategoryCard,
    value: string
  ) {
    updateSection("browseByCategory", (prev) => {
      const categories = [...prev.categories];
      categories[index] = { ...categories[index], [field]: value };
      return { ...prev, categories };
    });
  }

  function updateTestimonial(
    index: number,
    field: keyof TestimonialSiteContentItem,
    value: string | number | boolean
  ) {
    updateSection("testimonials", (prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function updateCorporateTestimonial(
    index: number,
    field: keyof TestimonialSiteContentItem,
    value: string | number | boolean
  ) {
    updateSection("corporateTestimonials", (prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  const activeTabMeta = TABS.find((t) => t.id === activeTab);
  const activePreview = activeTabMeta?.preview;

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading site content…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Content"
        description="Edit public website copy, images, and contact details shown on the storefront."
        breadcrumb="Site Content"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activePreview && (
              <a
                href={activePreview}
                target="_blank"
                rel="noopener noreferrer"
                className="platform-btn-ghost inline-flex items-center gap-2 text-sm"
              >
                <ExternalLink className="size-4" />
                Preview
              </a>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => saveSection(activeTab)}
              className="platform-btn-primary"
            >
              <Save className="size-4" />
              {saving ? "Saving…" : "Save section"}
            </button>
          </div>
        }
      />

      {loadWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {loadWarning}
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm",
            toastIsError
              ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
              : "border-[var(--platform-success)]/40 bg-[rgba(16,185,129,0.12)] text-[var(--platform-success)]",
          ].join(" ")}
        >
          {toastIsError ? (
            <XCircle className="size-5 shrink-0" />
          ) : (
            <CheckCircle2 className="size-5 shrink-0" />
          )}
          {toast}
        </div>
      )}

      <div className="space-y-4 border-b border-[var(--platform-border)] pb-3">
        {TAB_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-[rgba(107,33,168,0.15)] text-[var(--platform-accent)]"
                      : "text-[var(--platform-text-secondary)] hover:bg-[var(--platform-bg)] hover:text-[var(--platform-text)]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="platform-card space-y-6 rounded-xl p-6">
        <div className="flex items-center gap-3 border-b border-[var(--platform-border)] pb-4">
          <div className="flex size-10 items-center justify-center rounded-md bg-[rgba(107,33,168,0.12)] text-[var(--platform-accent)]">
            <Palette className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--platform-text)]">
              {activeTabMeta?.label}
            </h2>
            <p className="text-sm text-[var(--platform-text-secondary)]">
              Changes apply to the public site after saving.
            </p>
          </div>
        </div>

        {activeTab === "global" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name" className="sm:col-span-2">
              <TextInput
                value={content.global.siteName}
                onChange={(v) => updateSection("global", (p) => ({ ...p, siteName: v }))}
              />
            </Field>
            <Field label="WhatsApp number (digits only)">
              <TextInput
                value={content.global.whatsappNumber}
                onChange={(v) => updateSection("global", (p) => ({ ...p, whatsappNumber: v }))}
                placeholder="233244876784"
              />
            </Field>
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <SiteImageUpload
                label="Logo (white, dark backgrounds)"
                hint="Leave empty to use default /logo.png"
                value={content.global.logoWhiteUrl}
                onChange={(v) => updateSection("global", (p) => ({ ...p, logoWhiteUrl: v }))}
              />
              <SiteImageUpload
                label="Logo (purple, light backgrounds)"
                value={content.global.logoPurpleUrl}
                onChange={(v) => updateSection("global", (p) => ({ ...p, logoPurpleUrl: v }))}
              />
            </div>
          </div>
        )}

        {activeTab === "homepage" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow">
              <TextInput
                value={content.homepage.eyebrow}
                onChange={(v) => updateSection("homepage", (p) => ({ ...p, eyebrow: v }))}
              />
            </Field>
            <Field label="Headline" className="sm:col-span-2">
              <TextInput
                value={content.homepage.title}
                onChange={(v) => updateSection("homepage", (p) => ({ ...p, title: v }))}
              />
            </Field>
            <Field label="Subtitle" className="sm:col-span-2">
              <TextArea
                value={content.homepage.subtitle}
                onChange={(v) => updateSection("homepage", (p) => ({ ...p, subtitle: v }))}
              />
            </Field>
            <Field label="Hero background" className="sm:col-span-2">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--platform-text)]">
                  <input
                    type="radio"
                    name="heroBackgroundMode"
                    checked={content.homepage.heroBackgroundMode === "image"}
                    onChange={() =>
                      updateSection("homepage", (p) => ({ ...p, heroBackgroundMode: "image" }))
                    }
                  />
                  Image
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--platform-text)]">
                  <input
                    type="radio"
                    name="heroBackgroundMode"
                    checked={content.homepage.heroBackgroundMode === "video"}
                    onChange={() =>
                      updateSection("homepage", (p) => ({ ...p, heroBackgroundMode: "video" }))
                    }
                  />
                  Video
                </label>
              </div>
            </Field>
            {content.homepage.heroBackgroundMode === "image" ? (
              <div className="sm:col-span-2">
                <SiteImageUpload
                  label="Hero background image"
                  hint="Leave empty to use featured inventory photo"
                  value={content.homepage.backgroundImage}
                  onChange={(v) => updateSection("homepage", (p) => ({ ...p, backgroundImage: v }))}
                />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <SiteVideoUpload
                  label="Hero background video"
                  hint="MP4 or WebM up to 50MB, or paste a YouTube/Vimeo link. Empty uses /videos/hero-background.mp4 with /images/hero-pinterest-poster.jpg fallback."
                  fileUrl={content.homepage.backgroundVideoUrl}
                  embedUrl={content.homepage.backgroundVideoEmbedUrl}
                  onFileUrlChange={(v) =>
                    updateSection("homepage", (p) => ({ ...p, backgroundVideoUrl: v }))
                  }
                  onEmbedUrlChange={(v) =>
                    updateSection("homepage", (p) => ({ ...p, backgroundVideoEmbedUrl: v }))
                  }
                  display={{
                    videoAspect: content.homepage.videoAspect,
                    videoSize: content.homepage.videoSize,
                    videoObjectFit: content.homepage.videoObjectFit,
                  }}
                  onDisplayChange={(patch) =>
                    updateSection("homepage", (p) => ({ ...p, ...patch }))
                  }
                  embed={{
                    embedMinimalBranding: content.homepage.embedMinimalBranding,
                    embedHideControls: content.homepage.embedHideControls,
                    embedHideRelated: content.homepage.embedHideRelated,
                  }}
                  onEmbedChange={(patch) =>
                    updateSection("homepage", (p) => ({ ...p, ...patch }))
                  }
                  hideDisplaySize
                />
              </div>
            )}
            <Field label="Primary CTA label">
              <TextInput
                value={content.homepage.ctaPrimaryLabel}
                onChange={(v) => updateSection("homepage", (p) => ({ ...p, ctaPrimaryLabel: v }))}
              />
            </Field>
            <Field label="Primary CTA link">
              <TextInput
                value={content.homepage.ctaPrimaryHref}
                onChange={(v) => updateSection("homepage", (p) => ({ ...p, ctaPrimaryHref: v }))}
              />
            </Field>
            <Field label="Secondary CTA label">
              <TextInput
                value={content.homepage.ctaSecondaryLabel}
                onChange={(v) =>
                  updateSection("homepage", (p) => ({ ...p, ctaSecondaryLabel: v }))
                }
              />
            </Field>
            <Field label="Secondary CTA link">
              <TextInput
                value={content.homepage.ctaSecondaryHref}
                onChange={(v) =>
                  updateSection("homepage", (p) => ({ ...p, ctaSecondaryHref: v }))
                }
              />
            </Field>
            <Field label="Tertiary CTA label">
              <TextInput
                value={content.homepage.ctaTertiaryLabel}
                onChange={(v) =>
                  updateSection("homepage", (p) => ({ ...p, ctaTertiaryLabel: v }))
                }
              />
            </Field>
            <Field label="Tertiary CTA link">
              <TextInput
                value={content.homepage.ctaTertiaryHref}
                onChange={(v) =>
                  updateSection("homepage", (p) => ({ ...p, ctaTertiaryHref: v }))
                }
              />
            </Field>
          </div>
        )}

        {activeTab === "whyChooseUs" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Section title" className="sm:col-span-2">
                <TextInput
                  value={content.whyChooseUs.title}
                  onChange={(v) => updateSection("whyChooseUs", (p) => ({ ...p, title: v }))}
                />
              </Field>
              <Field label="Section description" className="sm:col-span-2">
                <TextArea
                  value={content.whyChooseUs.description}
                  onChange={(v) => updateSection("whyChooseUs", (p) => ({ ...p, description: v }))}
                />
              </Field>
            </div>
            {content.whyChooseUs.cards.map((card, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
              >
                <p className="text-sm font-medium text-[var(--platform-text)]">Card {i + 1}</p>
                <Field label="Icon">
                  <select
                    className="platform-input w-full"
                    value={card.icon}
                    onChange={(e) => updateWhyChooseCard(i, "icon", e.target.value)}
                  >
                    {SITE_CONTENT_ICON_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Title">
                  <TextInput
                    value={card.title}
                    onChange={(v) => updateWhyChooseCard(i, "title", v)}
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    value={card.description}
                    onChange={(v) => updateWhyChooseCard(i, "description", v)}
                  />
                </Field>
              </div>
            ))}
          </div>
        )}

        {activeTab === "browseByCategory" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Section title" className="sm:col-span-2">
                <TextInput
                  value={content.browseByCategory.title}
                  onChange={(v) =>
                    updateSection("browseByCategory", (p) => ({ ...p, title: v }))
                  }
                />
              </Field>
              <Field label="Section description" className="sm:col-span-2">
                <TextArea
                  value={content.browseByCategory.description}
                  onChange={(v) =>
                    updateSection("browseByCategory", (p) => ({ ...p, description: v }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <SiteVideoUpload
                  label="Section video (optional)"
                  hint="Upload MP4/WebM or paste a YouTube/Vimeo link. Shown above the category grid when set."
                  fileUrl={content.browseByCategory.videoUrl}
                  embedUrl={content.browseByCategory.videoEmbedUrl}
                  onFileUrlChange={(v) =>
                    updateSection("browseByCategory", (p) => ({ ...p, videoUrl: v }))
                  }
                  onEmbedUrlChange={(v) =>
                    updateSection("browseByCategory", (p) => ({ ...p, videoEmbedUrl: v }))
                  }
                  display={{
                    videoAspect: content.browseByCategory.videoAspect,
                    videoSize: content.browseByCategory.videoSize,
                    videoObjectFit: content.browseByCategory.videoObjectFit,
                  }}
                  onDisplayChange={(patch) =>
                    updateSection("browseByCategory", (p) => ({ ...p, ...patch }))
                  }
                  embed={{
                    embedMinimalBranding: content.browseByCategory.embedMinimalBranding,
                    embedHideControls: content.browseByCategory.embedHideControls,
                    embedHideRelated: content.browseByCategory.embedHideRelated,
                  }}
                  onEmbedChange={(patch) =>
                    updateSection("browseByCategory", (p) => ({ ...p, ...patch }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <SiteImageUpload
                  label="Background image fallback"
                  hint="Shown when no video is set. Leave empty for category cards only."
                  value={content.browseByCategory.backgroundImage}
                  savedValue={savedContent.browseByCategory.backgroundImage}
                  onChange={(v) =>
                    updateSection("browseByCategory", (p) => ({ ...p, backgroundImage: v }))
                  }
                />
              </div>
            </div>
            {content.browseByCategory.categories.map((category, i) => (
              <div
                key={category.id}
                className="space-y-4 rounded-lg border border-[var(--platform-border)] p-4"
              >
                <p className="text-sm font-medium text-[var(--platform-text)]">
                  {category.label || `Category ${i + 1}`}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Label">
                    <TextInput
                      value={category.label}
                      onChange={(v) => updateBrowseCategoryCard(i, "label", v)}
                    />
                  </Field>
                  <Field label="Inventory slug (body type)">
                    <TextInput
                      value={category.slug}
                      onChange={(v) => updateBrowseCategoryCard(i, "slug", v)}
                      placeholder="SUV, Sedan, Luxury…"
                    />
                  </Field>
                  <Field label="Link URL (optional)" className="sm:col-span-2">
                    <TextInput
                      value={category.href}
                      onChange={(v) => updateBrowseCategoryCard(i, "href", v)}
                      placeholder={`/inventory?bodyType=${category.slug || "SUV"}`}
                    />
                  </Field>
                  <Field label="Icon (optional, used when no image)">
                    <select
                      className="platform-input w-full"
                      value={category.icon}
                      onChange={(e) => updateBrowseCategoryCard(i, "icon", e.target.value)}
                    >
                      <option value="">None</option>
                      {SITE_CONTENT_ICON_NAMES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <SiteImageUpload
                      label="Category image"
                      hint="Leave empty to use a stock photo matched to this body type. Preview matches the storefront card."
                      value={category.image}
                      savedValue={savedContent.browseByCategory.categories[i]?.image ?? ""}
                      defaultPreview={categoryPhotoUrlFor(category.id, category.slug)}
                      previewSize="category"
                      previewLabel={category.label || `Category ${i + 1}`}
                      onChange={(v) => updateBrowseCategoryCard(i, "image", v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "testimonials" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Section title" className="sm:col-span-2">
                <TextInput
                  value={content.testimonials.title}
                  onChange={(v) => updateSection("testimonials", (p) => ({ ...p, title: v }))}
                />
              </Field>
              <Field label="Section description" className="sm:col-span-2">
                <TextArea
                  value={content.testimonials.description}
                  onChange={(v) =>
                    updateSection("testimonials", (p) => ({ ...p, description: v }))
                  }
                />
              </Field>
            </div>
            {content.testimonials.items.map((testimonial, i) => (
              <div
                key={testimonial.id}
                className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
              >
                <p className="text-sm font-medium text-[var(--platform-text)]">
                  {testimonial.name || `Testimonial ${i + 1}`}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <TextInput
                      value={testimonial.name}
                      onChange={(v) => updateTestimonial(i, "name", v)}
                    />
                  </Field>
                  <Field label="Location">
                    <TextInput
                      value={testimonial.location}
                      onChange={(v) => updateTestimonial(i, "location", v)}
                      placeholder="Accra, Ghana"
                    />
                  </Field>
                  <Field label="Vehicle purchased">
                    <TextInput
                      value={testimonial.vehicle}
                      onChange={(v) => updateTestimonial(i, "vehicle", v)}
                      placeholder="2024 BYD Atto 3"
                    />
                  </Field>
                  <Field label="Star rating (1–5)">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="platform-input w-full"
                      value={testimonial.rating}
                      onChange={(e) =>
                        updateTestimonial(
                          i,
                          "rating",
                          Math.min(5, Math.max(1, Number(e.target.value) || 1))
                        )
                      }
                    />
                  </Field>
                  <Field label="Quote" className="sm:col-span-2">
                    <TextArea
                      value={testimonial.quote}
                      onChange={(v) => updateTestimonial(i, "quote", v)}
                      rows={4}
                    />
                  </Field>
                  <Field label="Verified customer">
                    <label className="flex items-center gap-2 text-sm text-[var(--platform-text)]">
                      <input
                        type="checkbox"
                        checked={testimonial.verified}
                        onChange={(e) => updateTestimonial(i, "verified", e.target.checked)}
                      />
                      Show verified badge
                    </label>
                  </Field>
                  <div className="sm:col-span-2">
                    <SiteImageUpload
                      label="Profile photo"
                      hint="Leave empty to use the default placeholder for this slot"
                      value={testimonial.image}
                      defaultPreview={resolveTestimonialImage(
                        "",
                        i,
                        testimonial.name
                      )}
                      onChange={(v) => updateTestimonial(i, "image", v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "corporateTestimonials" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Section title" className="sm:col-span-2">
                <TextInput
                  value={content.corporateTestimonials.title}
                  onChange={(v) =>
                    updateSection("corporateTestimonials", (p) => ({ ...p, title: v }))
                  }
                />
              </Field>
              <Field label="Section description" className="sm:col-span-2">
                <TextArea
                  value={content.corporateTestimonials.description}
                  onChange={(v) =>
                    updateSection("corporateTestimonials", (p) => ({ ...p, description: v }))
                  }
                />
              </Field>
            </div>
            {content.corporateTestimonials.items.map((testimonial, i) => (
              <div
                key={testimonial.id}
                className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
              >
                <p className="text-sm font-medium text-[var(--platform-text)]">
                  {testimonial.name || `Testimonial ${i + 1}`}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <TextInput
                      value={testimonial.name}
                      onChange={(v) => updateCorporateTestimonial(i, "name", v)}
                    />
                  </Field>
                  <Field label="Location">
                    <TextInput
                      value={testimonial.location}
                      onChange={(v) => updateCorporateTestimonial(i, "location", v)}
                      placeholder="Accra, Ghana"
                    />
                  </Field>
                  <Field label="Service / context">
                    <TextInput
                      value={testimonial.vehicle}
                      onChange={(v) => updateCorporateTestimonial(i, "vehicle", v)}
                      placeholder="Freight & Clearing"
                    />
                  </Field>
                  <Field label="Star rating (1–5)">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="platform-input w-full"
                      value={testimonial.rating}
                      onChange={(e) =>
                        updateCorporateTestimonial(
                          i,
                          "rating",
                          Math.min(5, Math.max(1, Number(e.target.value) || 1))
                        )
                      }
                    />
                  </Field>
                  <Field label="Quote" className="sm:col-span-2">
                    <TextArea
                      value={testimonial.quote}
                      onChange={(v) => updateCorporateTestimonial(i, "quote", v)}
                      rows={4}
                    />
                  </Field>
                  <Field label="Verified customer">
                    <label className="flex items-center gap-2 text-sm text-[var(--platform-text)]">
                      <input
                        type="checkbox"
                        checked={testimonial.verified}
                        onChange={(e) =>
                          updateCorporateTestimonial(i, "verified", e.target.checked)
                        }
                      />
                      Show verified badge
                    </label>
                  </Field>
                  <div className="sm:col-span-2">
                    <SiteImageUpload
                      label="Profile photo"
                      hint="Leave empty to use the default placeholder for this slot"
                      value={testimonial.image}
                      defaultPreview={resolveTestimonialImage(
                        "",
                        i,
                        testimonial.name
                      )}
                      onChange={(v) => updateCorporateTestimonial(i, "image", v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Eyebrow">
                <TextInput
                  value={content.about.eyebrow}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, eyebrow: v }))}
                />
              </Field>
              <Field label="Hero title" className="sm:col-span-2">
                <TextInput
                  value={content.about.heroTitle}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, heroTitle: v }))}
                />
              </Field>
              <Field label="Hero subtitle" className="sm:col-span-2">
                <TextArea
                  value={content.about.heroSubtitle}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, heroSubtitle: v }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <SiteVideoUpload
                  label="Promo video (optional)"
                  hint="Upload MP4/WebM or paste a YouTube/Vimeo link. Shown below the hero when set."
                  fileUrl={content.about.promoVideoUrl}
                  embedUrl={content.about.promoVideoEmbedUrl}
                  onFileUrlChange={(v) =>
                    updateSection("about", (p) => ({ ...p, promoVideoUrl: v }))
                  }
                  onEmbedUrlChange={(v) =>
                    updateSection("about", (p) => ({ ...p, promoVideoEmbedUrl: v }))
                  }
                  display={{
                    videoAspect: content.about.videoAspect,
                    videoSize: content.about.videoSize,
                    videoObjectFit: content.about.videoObjectFit,
                  }}
                  onDisplayChange={(patch) =>
                    updateSection("about", (p) => ({ ...p, ...patch }))
                  }
                  embed={{
                    embedMinimalBranding: content.about.embedMinimalBranding,
                    embedHideControls: content.about.embedHideControls,
                    embedHideRelated: content.about.embedHideRelated,
                  }}
                  onEmbedChange={(patch) =>
                    updateSection("about", (p) => ({ ...p, ...patch }))
                  }
                />
              </div>
              <Field label="Promo video title (optional)">
                <TextInput
                  value={content.about.promoVideoTitle}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, promoVideoTitle: v }))}
                  placeholder="e.g. See how we inspect every vehicle"
                />
              </Field>
              <Field label="Mission title">
                <TextInput
                  value={content.about.missionTitle}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, missionTitle: v }))}
                />
              </Field>
              <Field label="Values section title">
                <TextInput
                  value={content.about.valuesTitle}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, valuesTitle: v }))}
                />
              </Field>
              <Field label="Mission description" className="sm:col-span-2">
                <TextArea
                  value={content.about.missionDescription}
                  onChange={(v) =>
                    updateSection("about", (p) => ({ ...p, missionDescription: v }))
                  }
                />
              </Field>
              <Field label="Mission body" className="sm:col-span-2">
                <TextArea
                  value={content.about.missionBody}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, missionBody: v }))}
                  rows={4}
                />
              </Field>
              <div className="sm:col-span-2">
                <SiteImageUpload
                  label="Mission image"
                  value={content.about.missionImage}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, missionImage: v }))}
                />
              </div>
              <Field label="Quality title">
                <TextInput
                  value={content.about.qualityTitle}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, qualityTitle: v }))}
                />
              </Field>
              <Field label="Quality description">
                <TextInput
                  value={content.about.qualityDescription}
                  onChange={(v) =>
                    updateSection("about", (p) => ({ ...p, qualityDescription: v }))
                  }
                />
              </Field>
              <Field label="Quality bullets (one per line)" className="sm:col-span-2">
                <TextArea
                  value={content.about.qualityBullets.join("\n")}
                  onChange={(v) =>
                    updateSection("about", (p) => ({
                      ...p,
                      qualityBullets: v.split("\n").filter(Boolean),
                    }))
                  }
                  rows={6}
                />
              </Field>
              <div className="sm:col-span-2">
                <SiteImageUpload
                  label="Quality section image"
                  value={content.about.qualityImage}
                  onChange={(v) => updateSection("about", (p) => ({ ...p, qualityImage: v }))}
                />
              </div>
            </div>
            {content.about.values.map((card, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
              >
                <p className="text-sm font-medium text-[var(--platform-text)]">Value {i + 1}</p>
                <Field label="Icon">
                  <select
                    className="platform-input w-full"
                    value={card.icon}
                    onChange={(e) => updateAboutValue(i, "icon", e.target.value)}
                  >
                    {SITE_CONTENT_ICON_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Title">
                  <TextInput
                    value={card.title}
                    onChange={(v) => updateAboutValue(i, "title", v)}
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    value={card.description}
                    onChange={(v) => updateAboutValue(i, "description", v)}
                  />
                </Field>
              </div>
            ))}
          </div>
        )}

        {activeTab === "footer" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tagline" className="sm:col-span-2">
              <TextArea
                value={content.footer.tagline}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, tagline: v }))}
              />
            </Field>
            <Field label="Address line 1">
              <TextInput
                value={content.footer.addressLine1}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, addressLine1: v }))}
              />
            </Field>
            <Field label="Address line 2">
              <TextInput
                value={content.footer.addressLine2}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, addressLine2: v }))}
              />
            </Field>
            <Field label="Phone display">
              <TextInput
                value={content.footer.phone}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, phone: v }))}
              />
            </Field>
            <Field label="Phone tel link">
              <TextInput
                value={content.footer.phoneTel}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, phoneTel: v }))}
              />
            </Field>
            <Field label="Email">
              <TextInput
                value={content.footer.email}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, email: v }))}
              />
            </Field>
            <Field label="Google Maps URL">
              <TextInput
                value={content.footer.mapsUrl}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, mapsUrl: v }))}
              />
            </Field>
            <Field label="Newsletter description" className="sm:col-span-2">
              <TextArea
                value={content.footer.newsletterDescription}
                onChange={(v) =>
                  updateSection("footer", (p) => ({ ...p, newsletterDescription: v }))
                }
              />
            </Field>
            <Field label="Facebook URL">
              <TextInput
                value={content.footer.socialFacebook}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, socialFacebook: v }))}
              />
            </Field>
            <Field label="Instagram URL">
              <TextInput
                value={content.footer.socialInstagram}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, socialInstagram: v }))}
              />
            </Field>
            <Field label="LinkedIn URL">
              <TextInput
                value={content.footer.socialLinkedIn}
                onChange={(v) => updateSection("footer", (p) => ({ ...p, socialLinkedIn: v }))}
              />
            </Field>
          </div>
        )}

        {activeTab === "header" && (
          <div className="space-y-4">
            {content.header.navLinks.map((link, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-lg border border-[var(--platform-border)] p-4 sm:grid-cols-2"
              >
                <Field label={`Nav item ${i + 1} label`}>
                  <TextInput
                    value={link.label}
                    onChange={(v) =>
                      updateSection("header", (p) => {
                        const navLinks = [...p.navLinks];
                        navLinks[i] = { ...navLinks[i], label: v };
                        return { ...p, navLinks };
                      })
                    }
                  />
                </Field>
                <Field label="Link URL">
                  <TextInput
                    value={link.href}
                    onChange={(v) =>
                      updateSection("header", (p) => {
                        const navLinks = [...p.navLinks];
                        navLinks[i] = { ...navLinks[i], href: v };
                        return { ...p, navLinks };
                      })
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
        )}

        {activeTab === "contact" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hero title" className="sm:col-span-2">
              <TextInput
                value={content.contact.heroTitle}
                onChange={(v) => updateSection("contact", (p) => ({ ...p, heroTitle: v }))}
              />
            </Field>
            <Field label="Hero subtitle" className="sm:col-span-2">
              <TextArea
                value={content.contact.heroSubtitle}
                onChange={(v) => updateSection("contact", (p) => ({ ...p, heroSubtitle: v }))}
              />
            </Field>
            <Field label="Weekday hours">
              <TextInput
                value={content.contact.hoursWeekday}
                onChange={(v) => updateSection("contact", (p) => ({ ...p, hoursWeekday: v }))}
              />
            </Field>
            <Field label="Saturday hours">
              <TextInput
                value={content.contact.hoursSaturday}
                onChange={(v) => updateSection("contact", (p) => ({ ...p, hoursSaturday: v }))}
              />
            </Field>
            <Field label="Sunday hours">
              <TextInput
                value={content.contact.hoursSunday}
                onChange={(v) => updateSection("contact", (p) => ({ ...p, hoursSunday: v }))}
              />
            </Field>
          </div>
        )}

        <CorporateContentEditors
          activeTab={activeTab}
          content={content}
          savedContent={savedContent}
          updateSection={updateSection}
        />

        {(activeTab === "buy" || activeTab === "sell" || activeTab === "financing") && (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeTab === "financing" && (
              <Field label="Eyebrow">
                <TextInput
                  value={content.financing.eyebrow ?? ""}
                  onChange={(v) => updateSection("financing", (p) => ({ ...p, eyebrow: v }))}
                />
              </Field>
            )}
            <Field label="Hero title" className="sm:col-span-2">
              <TextInput
                value={content[activeTab].title}
                onChange={(v) => updateSection(activeTab, (p) => ({ ...p, title: v }))}
              />
            </Field>
            <Field label="Hero subtitle" className="sm:col-span-2">
              <TextArea
                value={content[activeTab].subtitle}
                onChange={(v) => updateSection(activeTab, (p) => ({ ...p, subtitle: v }))}
              />
            </Field>
          </div>
        )}

        <SaveSectionBar
          label={activeTabMeta?.label ?? activeTab}
          saving={saving}
          saveState={sectionSaveState}
          onSave={() => saveSection(activeTab)}
        />
      </div>
    </div>
  );
}
