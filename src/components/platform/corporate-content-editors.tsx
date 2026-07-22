"use client";

import { SiteImageUpload } from "@/components/platform/site-image-upload";
import { SiteVideoUpload } from "@/components/platform/site-video-upload";
import type { SiteContent, SiteContentSection } from "@/lib/site-content/defaults";
import { SITE_CONTENT_ICON_NAMES } from "@/lib/site-content-icons";

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

type CorporateContentEditorsProps = {
  activeTab: SiteContentSection;
  content: SiteContent;
  savedContent: SiteContent;
  updateSection: <K extends SiteContentSection>(
    section: K,
    updater: (prev: SiteContent[K]) => SiteContent[K]
  ) => void;
};

export function CorporateContentEditors({
  activeTab,
  content,
  savedContent,
  updateSection,
}: CorporateContentEditorsProps) {
  if (activeTab === "corporateHomepage") {
    const hp = content.corporateHomepage;
    return (
      <div className="space-y-8">
        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">Hero</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" className="sm:col-span-2">
              <TextInput
                value={hp.heroEyebrow}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, heroEyebrow: v }))
                }
              />
            </Field>
            <Field label="Headline" className="sm:col-span-2">
              <TextInput
                value={hp.heroTitle}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, heroTitle: v }))
                }
              />
            </Field>
            <Field label="Subtitle" className="sm:col-span-2">
              <TextArea
                value={hp.heroSubtitle}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, heroSubtitle: v }))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <SiteVideoUpload
                label="Hero background video"
                hint="MP4/WebM or leave empty for default /videos/corporate-hero.mp4"
                fileUrl={hp.heroVideoUrl}
                embedUrl=""
                onFileUrlChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, heroVideoUrl: v }))
                }
                onEmbedUrlChange={() => {}}
                display={{
                  videoAspect: "16:9",
                  videoSize: "full",
                  videoObjectFit: "cover",
                }}
                onDisplayChange={() => {}}
                embed={{
                  embedMinimalBranding: true,
                  embedHideControls: true,
                  embedHideRelated: true,
                }}
                onEmbedChange={() => {}}
                hideDisplaySize
              />
            </div>
            <div className="sm:col-span-2">
              <SiteImageUpload
                label="Hero poster image"
                hint="Shown before video loads"
                value={hp.heroPosterUrl}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, heroPosterUrl: v }))
                }
              />
            </div>
            <Field label="Primary CTA label">
              <TextInput
                value={hp.ctaPrimaryLabel}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, ctaPrimaryLabel: v }))
                }
              />
            </Field>
            <Field label="Primary CTA link">
              <TextInput
                value={hp.ctaPrimaryHref}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, ctaPrimaryHref: v }))
                }
              />
            </Field>
            <Field label="Secondary CTA label">
              <TextInput
                value={hp.ctaSecondaryLabel}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, ctaSecondaryLabel: v }))
                }
              />
            </Field>
            <Field label="Secondary CTA link">
              <TextInput
                value={hp.ctaSecondaryHref}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, ctaSecondaryHref: v }))
                }
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">About section</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <TextInput
                value={hp.aboutTitle}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, aboutTitle: v }))
                }
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <TextArea
                value={hp.aboutDescription}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, aboutDescription: v }))
                }
              />
            </Field>
            <Field label="Specialty bullets (one per line)" className="sm:col-span-2">
              <TextArea
                value={hp.aboutSpecialties.join("\n")}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({
                    ...p,
                    aboutSpecialties: v.split("\n").filter(Boolean),
                  }))
                }
                rows={6}
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">Contact CTA</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <TextInput
                value={hp.contactCtaTitle}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, contactCtaTitle: v }))
                }
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <TextArea
                value={hp.contactCtaDescription}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, contactCtaDescription: v }))
                }
              />
            </Field>
            <Field label="Primary button label">
              <TextInput
                value={hp.contactCtaPrimaryLabel}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, contactCtaPrimaryLabel: v }))
                }
              />
            </Field>
            <Field label="Primary button link">
              <TextInput
                value={hp.contactCtaPrimaryHref}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, contactCtaPrimaryHref: v }))
                }
              />
            </Field>
            <Field label="Secondary button label">
              <TextInput
                value={hp.contactCtaSecondaryLabel}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, contactCtaSecondaryLabel: v }))
                }
              />
            </Field>
            <Field label="Secondary button link">
              <TextInput
                value={hp.contactCtaSecondaryHref}
                onChange={(v) =>
                  updateSection("corporateHomepage", (p) => ({ ...p, contactCtaSecondaryHref: v }))
                }
              />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "startYourJourney") {
    const journey = content.startYourJourney;
    const savedJourney = savedContent.startYourJourney;
    return (
      <div className="space-y-8">
        <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted,transparent)] p-4">
          <h3 className="text-sm font-semibold text-[var(--platform-text)]">
            How can we help you today?
          </h3>
          <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
            Homepage service tiles shown under the hero on{" "}
            <span className="font-medium text-[var(--platform-text)]">/</span>. Edit section copy,
            card images, links, and the advisor tile.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">
            Section heading
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <TextInput
                value={journey.title}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({ ...p, title: v }))
                }
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <TextArea
                value={journey.description}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({ ...p, description: v }))
                }
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--platform-text)]">Service tiles</h3>
          {journey.cards.map((card, i) => (
            <div
              key={card.id}
              className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
            >
              <p className="text-sm font-medium text-[var(--platform-text)]">
                Tile {i + 1}
                <span className="ml-2 font-normal text-[var(--platform-text-secondary)]">
                  ({card.id})
                </span>
              </p>
              <Field label="Icon">
                <select
                  className="platform-input w-full"
                  value={card.icon}
                  onChange={(e) =>
                    updateSection("startYourJourney", (p) => {
                      const cards = [...p.cards];
                      cards[i] = {
                        ...cards[i],
                        icon: e.target.value as (typeof cards)[number]["icon"],
                      };
                      return { ...p, cards };
                    })
                  }
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
                  onChange={(v) =>
                    updateSection("startYourJourney", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], title: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Description">
                <TextArea
                  value={card.description}
                  onChange={(v) =>
                    updateSection("startYourJourney", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], description: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Button label (CTA)">
                <TextInput
                  value={card.cta}
                  onChange={(v) =>
                    updateSection("startYourJourney", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], cta: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Button link">
                <TextInput
                  value={card.href}
                  onChange={(v) =>
                    updateSection("startYourJourney", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], href: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Image alt text">
                <TextInput
                  value={card.imageAlt}
                  onChange={(v) =>
                    updateSection("startYourJourney", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], imageAlt: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <SiteImageUpload
                label="Tile image"
                hint="Upload or paste a URL — shown on the homepage tile"
                value={card.image}
                savedValue={savedJourney.cards[i]?.image}
                previewSize="category"
                previewLabel={card.title || `Tile ${i + 1}`}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], image: v };
                    return { ...p, cards };
                  })
                }
              />
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">
            Advisor tile
          </h3>
          <div className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4">
            <Field label="Title">
              <TextInput
                value={journey.advisor.title}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, title: v },
                  }))
                }
              />
            </Field>
            <Field label="Description">
              <TextArea
                value={journey.advisor.description}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, description: v },
                  }))
                }
              />
            </Field>
            <Field label="Primary button label (WhatsApp)">
              <TextInput
                value={journey.advisor.primaryLabel}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, primaryLabel: v },
                  }))
                }
              />
            </Field>
            <Field label="WhatsApp prefilled message">
              <TextArea
                value={journey.advisor.whatsappMessage}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, whatsappMessage: v },
                  }))
                }
              />
            </Field>
            <Field label="Secondary button label">
              <TextInput
                value={journey.advisor.secondaryLabel}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, secondaryLabel: v },
                  }))
                }
              />
            </Field>
            <Field label="Secondary button link">
              <TextInput
                value={journey.advisor.secondaryHref}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, secondaryHref: v },
                  }))
                }
              />
            </Field>
            <Field label="Image alt text">
              <TextInput
                value={journey.advisor.imageAlt}
                onChange={(v) =>
                  updateSection("startYourJourney", (p) => ({
                    ...p,
                    advisor: { ...p.advisor, imageAlt: v },
                  }))
                }
              />
            </Field>
            <SiteImageUpload
              label="Advisor tile image"
              hint="Upload or paste a URL"
              value={journey.advisor.image}
              savedValue={savedJourney.advisor.image}
              previewSize="category"
              previewLabel={journey.advisor.title || "Advisor"}
              onChange={(v) =>
                updateSection("startYourJourney", (p) => ({
                  ...p,
                  advisor: { ...p.advisor, image: v },
                }))
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "corporateServices") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Section title" className="sm:col-span-2">
            <TextInput
              value={content.corporateServices.title}
              onChange={(v) =>
                updateSection("corporateServices", (p) => ({ ...p, title: v }))
              }
            />
          </Field>
          <Field label="Section description" className="sm:col-span-2">
            <TextArea
              value={content.corporateServices.description}
              onChange={(v) =>
                updateSection("corporateServices", (p) => ({ ...p, description: v }))
              }
            />
          </Field>
        </div>
        {content.corporateServices.cards.map((card, i) => (
          <div
            key={card.id}
            className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
          >
            <p className="text-sm font-medium text-[var(--platform-text)]">Service card {i + 1}</p>
            <Field label="Title">
              <TextInput
                value={card.title}
                onChange={(v) =>
                  updateSection("corporateServices", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], title: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={card.subtitle}
                onChange={(v) =>
                  updateSection("corporateServices", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], subtitle: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Link URL">
              <TextInput
                value={card.href}
                onChange={(v) =>
                  updateSection("corporateServices", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], href: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Image alt text">
              <TextInput
                value={card.imageAlt}
                onChange={(v) =>
                  updateSection("corporateServices", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], imageAlt: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <SiteImageUpload
              label="Card image"
              value={card.image}
              onChange={(v) =>
                updateSection("corporateServices", (p) => {
                  const cards = [...p.cards];
                  cards[i] = { ...cards[i], image: v };
                  return { ...p, cards };
                })
              }
            />
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "corporateStats") {
    return (
      <div className="space-y-4">
        {content.corporateStats.items.map((stat, i) => (
          <div
            key={stat.id}
            className="grid gap-3 rounded-lg border border-[var(--platform-border)] p-4 sm:grid-cols-2"
          >
            <p className="text-sm font-medium text-[var(--platform-text)] sm:col-span-2">
              Stat {i + 1}
            </p>
            <Field label="Value">
              <TextInput
                value={stat.value}
                onChange={(v) =>
                  updateSection("corporateStats", (p) => {
                    const items = [...p.items];
                    items[i] = { ...items[i], value: v };
                    return { ...p, items };
                  })
                }
              />
            </Field>
            <Field label="Label">
              <TextInput
                value={stat.label}
                onChange={(v) =>
                  updateSection("corporateStats", (p) => {
                    const items = [...p.items];
                    items[i] = { ...items[i], label: v };
                    return { ...p, items };
                  })
                }
              />
            </Field>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "corporateFaq") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Section title" className="sm:col-span-2">
            <TextInput
              value={content.corporateFaq.title}
              onChange={(v) => updateSection("corporateFaq", (p) => ({ ...p, title: v }))}
            />
          </Field>
          <Field label="Section description" className="sm:col-span-2">
            <TextArea
              value={content.corporateFaq.description}
              onChange={(v) => updateSection("corporateFaq", (p) => ({ ...p, description: v }))}
            />
          </Field>
        </div>
        {content.corporateFaq.items.map((item, i) => (
          <div
            key={item.id}
            className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
          >
            <p className="text-sm font-medium text-[var(--platform-text)]">FAQ {i + 1}</p>
            <Field label="Question">
              <TextInput
                value={item.question}
                onChange={(v) =>
                  updateSection("corporateFaq", (p) => {
                    const items = [...p.items];
                    items[i] = { ...items[i], question: v };
                    return { ...p, items };
                  })
                }
              />
            </Field>
            <Field label="Answer">
              <TextArea
                value={item.answer}
                onChange={(v) =>
                  updateSection("corporateFaq", (p) => {
                    const items = [...p.items];
                    items[i] = { ...items[i], answer: v };
                    return { ...p, items };
                  })
                }
              />
            </Field>
          </div>
        ))}
      </div>
    );
  }

  if (
    activeTab === "corporateServicesPage" ||
    activeTab === "freightLanding" ||
    activeTab === "shippingConsultation"
  ) {
    const page = content[activeTab];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hero eyebrow (optional)" className="sm:col-span-2">
            <TextInput
              value={page.heroEyebrow}
              onChange={(v) => updateSection(activeTab, (p) => ({ ...p, heroEyebrow: v }))}
            />
          </Field>
          <Field label="Hero title" className="sm:col-span-2">
            <TextInput
              value={page.heroTitle}
              onChange={(v) => updateSection(activeTab, (p) => ({ ...p, heroTitle: v }))}
            />
          </Field>
          <Field label="Hero subtitle" className="sm:col-span-2">
            <TextArea
              value={page.heroSubtitle}
              onChange={(v) => updateSection(activeTab, (p) => ({ ...p, heroSubtitle: v }))}
            />
          </Field>
        </div>
        {page.cards.map((card, i) => (
          <div
            key={card.id}
            className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
          >
            <p className="text-sm font-medium text-[var(--platform-text)]">Card {i + 1}</p>
            <Field label="Icon">
              <select
                className="platform-input w-full"
                value={card.icon}
                onChange={(e) =>
                  updateSection(activeTab, (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], icon: e.target.value as typeof card.icon };
                    return { ...p, cards };
                  })
                }
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
                onChange={(v) =>
                  updateSection(activeTab, (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], title: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Description">
              <TextArea
                value={card.description}
                onChange={(v) =>
                  updateSection(activeTab, (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], description: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Image alt text">
              <TextInput
                value={card.imageAlt}
                onChange={(v) =>
                  updateSection(activeTab, (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], imageAlt: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <SiteImageUpload
              label="Card image"
              value={card.image}
              onChange={(v) =>
                updateSection(activeTab, (p) => {
                  const cards = [...p.cards];
                  cards[i] = { ...cards[i], image: v };
                  return { ...p, cards };
                })
              }
            />
            {activeTab === "corporateServicesPage" && (
              <>
                <Field label="Button label">
                  <TextInput
                    value={card.cta}
                    onChange={(v) =>
                      updateSection(activeTab, (p) => {
                        const cards = [...p.cards];
                        cards[i] = { ...cards[i], cta: v };
                        return { ...p, cards };
                      })
                    }
                  />
                </Field>
                <Field label="Button link">
                  <TextInput
                    value={card.href}
                    onChange={(v) =>
                      updateSection(activeTab, (p) => {
                        const cards = [...p.cards];
                        cards[i] = { ...cards[i], href: v };
                        return { ...p, cards };
                      })
                    }
                  />
                </Field>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "sparePartsLanding") {
    const page = content.sparePartsLanding;
    const savedPage = savedContent.sparePartsLanding;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page title" className="sm:col-span-2">
            <TextInput
              value={page.title}
              onChange={(v) => updateSection("sparePartsLanding", (p) => ({ ...p, title: v }))}
            />
          </Field>
          <Field label="Page description" className="sm:col-span-2">
            <TextArea
              value={page.subtitle}
              onChange={(v) => updateSection("sparePartsLanding", (p) => ({ ...p, subtitle: v }))}
            />
          </Field>
        </div>
        <p className="text-sm text-[var(--platform-text-secondary)]">
          Each category card below appears on the public spare parts landing page. Upload or paste a
          URL for the card image.
        </p>
        {page.cards.map((card, i) => (
          <div
            key={card.id}
            className="space-y-4 rounded-lg border border-[var(--platform-border)] p-4"
          >
            <p className="text-sm font-medium text-[var(--platform-text)]">
              {card.title || `Category card ${i + 1}`}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Icon (fallback when no image)">
                <select
                  className="platform-input w-full"
                  value={card.icon}
                  onChange={(e) =>
                    updateSection("sparePartsLanding", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], icon: e.target.value as typeof card.icon };
                      return { ...p, cards };
                    })
                  }
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
                  onChange={(v) =>
                    updateSection("sparePartsLanding", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], title: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <TextArea
                  value={card.description}
                  onChange={(v) =>
                    updateSection("sparePartsLanding", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], description: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Link (optional)" className="sm:col-span-2">
                <TextInput
                  value={card.href}
                  onChange={(v) =>
                    updateSection("sparePartsLanding", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], href: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <Field label="Image alt text" className="sm:col-span-2">
                <TextInput
                  value={card.imageAlt}
                  onChange={(v) =>
                    updateSection("sparePartsLanding", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], imageAlt: v };
                      return { ...p, cards };
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <SiteImageUpload
                  label="Category card image"
                  hint="Leave empty to use the default stock image for this category. Preview matches the storefront card."
                  value={card.image}
                  savedValue={savedPage.cards[i]?.image ?? ""}
                  defaultPreview={savedPage.cards[i]?.image || card.image}
                  previewSize="category"
                  previewLabel={card.title || `Category ${i + 1}`}
                  onChange={(v) =>
                    updateSection("sparePartsLanding", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], image: v };
                      return { ...p, cards };
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "corporateDivisions") {
    const section = content.corporateDivisions;
    return (
      <div className="space-y-8">
        <Field label="Section title">
          <TextInput
            value={section.title}
            onChange={(v) => updateSection("corporateDivisions", (p) => ({ ...p, title: v }))}
          />
        </Field>
        <Field label="Section description">
          <TextArea
            value={section.description}
            onChange={(v) => updateSection("corporateDivisions", (p) => ({ ...p, description: v }))}
          />
        </Field>
        {section.cards.map((card, i) => (
          <div key={card.id} className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4">
            <p className="text-sm font-medium">Division card {i + 1}</p>
            <Field label="Title">
              <TextInput
                value={card.title}
                onChange={(v) =>
                  updateSection("corporateDivisions", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], title: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Subtitle">
              <TextArea
                value={card.description}
                onChange={(v) =>
                  updateSection("corporateDivisions", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], description: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Link URL">
              <TextInput
                value={card.href}
                onChange={(v) =>
                  updateSection("corporateDivisions", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], href: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <Field label="Image alt text">
              <TextInput
                value={card.imageAlt}
                onChange={(v) =>
                  updateSection("corporateDivisions", (p) => {
                    const cards = [...p.cards];
                    cards[i] = { ...cards[i], imageAlt: v };
                    return { ...p, cards };
                  })
                }
              />
            </Field>
            <SiteImageUpload
              label="Card image"
              value={card.image}
              onChange={(v) =>
                updateSection("corporateDivisions", (p) => {
                  const cards = [...p.cards];
                  cards[i] = { ...cards[i], image: v };
                  return { ...p, cards };
                })
              }
            />
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "inventoryPage") {
    const page = content.inventoryPage;
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inventory title">
          <TextInput
            value={page.title}
            onChange={(v) => updateSection("inventoryPage", (p) => ({ ...p, title: v }))}
          />
        </Field>
        <Field label="Pre-order title">
          <TextInput
            value={page.preorderTitle}
            onChange={(v) => updateSection("inventoryPage", (p) => ({ ...p, preorderTitle: v }))}
          />
        </Field>
        <Field label="Inventory subtitle" className="sm:col-span-2">
          <TextArea
            value={page.subtitle}
            onChange={(v) => updateSection("inventoryPage", (p) => ({ ...p, subtitle: v }))}
          />
        </Field>
        <Field label="Pre-order subtitle" className="sm:col-span-2">
          <TextArea
            value={page.preorderSubtitle}
            onChange={(v) =>
              updateSection("inventoryPage", (p) => ({ ...p, preorderSubtitle: v }))
            }
          />
        </Field>
      </div>
    );
  }

  if (activeTab === "freightTracking") {
    const page = content.freightTracking;
    const form = page.form;
    return (
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page title" className="sm:col-span-2">
            <TextInput
              value={page.title}
              onChange={(v) => updateSection("freightTracking", (p) => ({ ...p, title: v }))}
            />
          </Field>
          <Field label="Page description" className="sm:col-span-2">
            <TextArea
              value={page.subtitle}
              onChange={(v) => updateSection("freightTracking", (p) => ({ ...p, subtitle: v }))}
            />
          </Field>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">Info cards</h3>
          <div className="space-y-6">
            {page.cards.map((card, i) => (
              <div
                key={card.id}
                className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4"
              >
                <p className="text-sm font-medium text-[var(--platform-text)]">Card {i + 1}</p>
                <Field label="Title">
                  <TextInput
                    value={card.title}
                    onChange={(v) =>
                      updateSection("freightTracking", (p) => {
                        const cards = [...p.cards];
                        cards[i] = { ...cards[i], title: v };
                        return { ...p, cards };
                      })
                    }
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    value={card.description}
                    onChange={(v) =>
                      updateSection("freightTracking", (p) => {
                        const cards = [...p.cards];
                        cards[i] = { ...cards[i], description: v };
                        return { ...p, cards };
                      })
                    }
                  />
                </Field>
                <Field label="Image alt text">
                  <TextInput
                    value={card.imageAlt}
                    onChange={(v) =>
                      updateSection("freightTracking", (p) => {
                        const cards = [...p.cards];
                        cards[i] = { ...cards[i], imageAlt: v };
                        return { ...p, cards };
                      })
                    }
                  />
                </Field>
                <SiteImageUpload
                  label="Card image"
                  value={card.image}
                  onChange={(v) =>
                    updateSection("freightTracking", (p) => {
                      const cards = [...p.cards];
                      cards[i] = { ...cards[i], image: v };
                      return { ...p, cards };
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--platform-text)]">Tracking form</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tracking number label">
              <TextInput
                value={form.trackingNumberLabel}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, trackingNumberLabel: v },
                  }))
                }
              />
            </Field>
            <Field label="Tracking number placeholder">
              <TextInput
                value={form.trackingNumberPlaceholder}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, trackingNumberPlaceholder: v },
                  }))
                }
              />
            </Field>
            <Field label="Email label">
              <TextInput
                value={form.emailLabel}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, emailLabel: v },
                  }))
                }
              />
            </Field>
            <Field label="Email placeholder">
              <TextInput
                value={form.emailPlaceholder}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, emailPlaceholder: v },
                  }))
                }
              />
            </Field>
            <Field label="Phone label">
              <TextInput
                value={form.phoneLabel}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, phoneLabel: v },
                  }))
                }
              />
            </Field>
            <Field label="Phone placeholder">
              <TextInput
                value={form.phonePlaceholder}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, phonePlaceholder: v },
                  }))
                }
              />
            </Field>
            <Field label="Help text" className="sm:col-span-2">
              <TextArea
                value={form.helpText}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, helpText: v },
                  }))
                }
              />
            </Field>
            <Field label="Submit button label">
              <TextInput
                value={form.submitLabel}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, submitLabel: v },
                  }))
                }
              />
            </Field>
            <Field label="Loading button label">
              <TextInput
                value={form.loadingLabel}
                onChange={(v) =>
                  updateSection("freightTracking", (p) => ({
                    ...p,
                    form: { ...p.form, loadingLabel: v },
                  }))
                }
              />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
