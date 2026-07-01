import {
  COMPANY_NAME,
  GOOGLE_MAPS_URL,
  SITE_ADDRESS_LINE1,
  SITE_ADDRESS_LINE2,
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE_DISPLAY,
  SITE_PHONE_INTL,
  WHATSAPP_NUMBER,
} from "@/lib/constants";
import type { SiteContentIconName } from "@/lib/site-content-icons";
import type { SiteVideoDisplaySettings } from "@/lib/site-content/video-display";
import type { SiteVideoEmbedSettings } from "@/lib/site-content/video-embed";
import {
  DEFAULT_CORPORATE_FAQ,
  DEFAULT_CORPORATE_HOMEPAGE,
  DEFAULT_CORPORATE_SERVICES,
  DEFAULT_CORPORATE_SERVICES_PAGE,
  DEFAULT_CORPORATE_STATS,
  DEFAULT_CORPORATE_DIVISIONS,
  DEFAULT_FREIGHT_LANDING,
  DEFAULT_FREIGHT_TRACKING_PAGE,
  DEFAULT_INVENTORY_PAGE,
  DEFAULT_SHIPPING_CONSULTATION,
  DEFAULT_SPARE_PARTS_LANDING,
  mergeCorporateFaqItems,
  mergeCorporateServiceCards,
  mergeCorporateStatItems,
  mergeDivisionLandingCards,
  type CorporateFaqSiteContent,
  type CorporateHomepageSiteContent,
  type CorporateServicesSiteContent,
  type CorporateStatsSiteContent,
  type CorporateDivisionsSiteContent,
  type DivisionLandingSiteContent,
  type FreightTrackingSiteContent,
  type InventoryPageSiteContent,
  type PageHeroSiteContentSimple,
  type SparePartsLandingSiteContent,
} from "@/lib/site-content/corporate-defaults";

export type {
  CorporateFaqItem,
  CorporateFaqSiteContent,
  CorporateHomepageSiteContent,
  CorporateServiceCard,
  CorporateServicesSiteContent,
  CorporateStatItem,
  CorporateStatsSiteContent,
  DivisionLandingCard,
  DivisionLandingSiteContent,
  FreightTrackingSiteContent,
  InventoryPageSiteContent,
  PageHeroSiteContentSimple,
  SparePartsLandingSiteContent,
  CorporateDivisionsSiteContent,
} from "@/lib/site-content/corporate-defaults";

export type SiteContentCard = {
  icon: SiteContentIconName;
  title: string;
  description: string;
};

export type SiteContentNavLink = {
  href: string;
  label: string;
};

export type GlobalSiteContent = {
  siteName: string;
  logoWhiteUrl: string;
  logoPurpleUrl: string;
  logoIconWhiteUrl: string;
  logoIconPurpleUrl: string;
  whatsappNumber: string;
};

export type HeroBackgroundMode = "image" | "video";

export type HomepageSiteContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  heroBackgroundMode: HeroBackgroundMode;
  backgroundImage: string;
  backgroundVideoUrl: string;
  backgroundVideoEmbedUrl: string;
  videoAspect: SiteVideoDisplaySettings["videoAspect"];
  videoSize: SiteVideoDisplaySettings["videoSize"];
  videoObjectFit: SiteVideoDisplaySettings["videoObjectFit"];
  embedMinimalBranding: SiteVideoEmbedSettings["embedMinimalBranding"];
  embedHideControls: SiteVideoEmbedSettings["embedHideControls"];
  embedHideRelated: SiteVideoEmbedSettings["embedHideRelated"];
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  ctaTertiaryLabel: string;
  ctaTertiaryHref: string;
};

export type WhyChooseUsSiteContent = {
  title: string;
  description: string;
  cards: SiteContentCard[];
};

export type AboutSiteContent = {
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  promoVideoTitle: string;
  promoVideoUrl: string;
  promoVideoEmbedUrl: string;
  videoAspect: SiteVideoDisplaySettings["videoAspect"];
  videoSize: SiteVideoDisplaySettings["videoSize"];
  videoObjectFit: SiteVideoDisplaySettings["videoObjectFit"];
  embedMinimalBranding: SiteVideoEmbedSettings["embedMinimalBranding"];
  embedHideControls: SiteVideoEmbedSettings["embedHideControls"];
  embedHideRelated: SiteVideoEmbedSettings["embedHideRelated"];
  missionTitle: string;
  missionDescription: string;
  missionBody: string;
  missionImage: string;
  valuesTitle: string;
  values: SiteContentCard[];
  qualityTitle: string;
  qualityDescription: string;
  qualityBullets: string[];
  qualityImage: string;
};

export type FooterSiteContent = {
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  phoneTel: string;
  email: string;
  mapsUrl: string;
  newsletterDescription: string;
  socialFacebook: string;
  socialInstagram: string;
  socialLinkedIn: string;
};

export type HeaderSiteContent = {
  navLinks: SiteContentNavLink[];
};

export type ContactSiteContent = {
  heroTitle: string;
  heroSubtitle: string;
  hoursWeekday: string;
  hoursSaturday: string;
  hoursSunday: string;
};

export type PageHeroSiteContent = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  backgroundImage?: string;
};

export type BrowseByCategoryCard = {
  id: string;
  label: string;
  slug: string;
  href: string;
  image: string;
  icon: SiteContentIconName | "";
};

export type BrowseByCategorySiteContent = {
  title: string;
  description: string;
  videoUrl: string;
  videoEmbedUrl: string;
  videoAspect: SiteVideoDisplaySettings["videoAspect"];
  videoSize: SiteVideoDisplaySettings["videoSize"];
  videoObjectFit: SiteVideoDisplaySettings["videoObjectFit"];
  embedMinimalBranding: SiteVideoEmbedSettings["embedMinimalBranding"];
  embedHideControls: SiteVideoEmbedSettings["embedHideControls"];
  embedHideRelated: SiteVideoEmbedSettings["embedHideRelated"];
  backgroundImage: string;
  categories: BrowseByCategoryCard[];
};

export type TestimonialSiteContentItem = {
  id: string;
  name: string;
  location: string;
  vehicle: string;
  rating: number;
  quote: string;
  image: string;
  verified: boolean;
};

export type TestimonialsSiteContent = {
  title: string;
  description: string;
  items: TestimonialSiteContentItem[];
};

export type SiteContent = {
  global: GlobalSiteContent;
  homepage: HomepageSiteContent;
  whyChooseUs: WhyChooseUsSiteContent;
  browseByCategory: BrowseByCategorySiteContent;
  testimonials: TestimonialsSiteContent;
  corporateTestimonials: TestimonialsSiteContent;
  corporateHomepage: CorporateHomepageSiteContent;
  corporateServices: CorporateServicesSiteContent;
  corporateStats: CorporateStatsSiteContent;
  corporateFaq: CorporateFaqSiteContent;
  corporateServicesPage: DivisionLandingSiteContent;
  freightLanding: DivisionLandingSiteContent;
  shippingConsultation: DivisionLandingSiteContent;
  sparePartsLanding: SparePartsLandingSiteContent;
  corporateDivisions: CorporateDivisionsSiteContent;
  inventoryPage: InventoryPageSiteContent;
  freightTracking: FreightTrackingSiteContent;
  about: AboutSiteContent;
  footer: FooterSiteContent;
  header: HeaderSiteContent;
  contact: ContactSiteContent;
  buy: PageHeroSiteContent;
  sell: PageHeroSiteContent;
  financing: PageHeroSiteContent;
};

export const SITE_CONTENT_SECTIONS = [
  "global",
  "homepage",
  "whyChooseUs",
  "browseByCategory",
  "testimonials",
  "corporateTestimonials",
  "corporateHomepage",
  "corporateServices",
  "corporateStats",
  "corporateFaq",
  "corporateServicesPage",
  "freightLanding",
  "shippingConsultation",
  "sparePartsLanding",
  "corporateDivisions",
  "inventoryPage",
  "freightTracking",
  "about",
  "footer",
  "header",
  "contact",
  "buy",
  "sell",
  "financing",
] as const;

export type SiteContentSection = (typeof SITE_CONTENT_SECTIONS)[number];

export const SECTION_DB_KEYS: Record<SiteContentSection, string> = {
  global: "global",
  homepage: "homepage",
  whyChooseUs: "why_choose_us",
  browseByCategory: "browse_by_category",
  testimonials: "testimonials",
  corporateTestimonials: "corporate_testimonials",
  corporateHomepage: "corporate_homepage",
  corporateServices: "corporate_services",
  corporateStats: "corporate_stats",
  corporateFaq: "corporate_faq",
  corporateServicesPage: "corporate_services_page",
  freightLanding: "freight_landing",
  shippingConsultation: "shipping_consultation",
  sparePartsLanding: "spare_parts_landing",
  corporateDivisions: "corporate_divisions",
  inventoryPage: "inventory_page",
  freightTracking: "freight_tracking",
  about: "about",
  footer: "footer",
  header: "header",
  contact: "contact",
  buy: "buy",
  sell: "sell",
  financing: "financing",
};

export const DB_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_DB_KEYS).map(([section, dbKey]) => [dbKey, section])
) as Record<string, SiteContentSection>;

export const DEFAULT_SITE_CONTENT: SiteContent = {
  global: {
    siteName: COMPANY_NAME,
    logoWhiteUrl: "",
    logoPurpleUrl: "",
    logoIconWhiteUrl: "",
    logoIconPurpleUrl: "",
    whatsappNumber: WHATSAPP_NUMBER,
  },
  homepage: {
    eyebrow: "TRUE GOSHEN AUTO",
    title: "Drive With Confidence",
    subtitle:
      "Curated premium vehicles, transparent pricing, and flexible pre-order options — from inquiry to delivery.",
    heroBackgroundMode: "video",
    backgroundImage: "",
    backgroundVideoUrl: "",
    backgroundVideoEmbedUrl: "",
    videoAspect: "9:16",
    videoSize: "full",
    videoObjectFit: "cover",
    embedMinimalBranding: true,
    embedHideControls: true,
    embedHideRelated: true,
    ctaPrimaryLabel: "Browse Inventory",
    ctaPrimaryHref: "/auto/inventory",
    ctaSecondaryLabel: "Pre-Order",
    ctaSecondaryHref: "/auto/inventory?status=pre_order",
    ctaTertiaryLabel: "Sell Your Vehicle",
    ctaTertiaryHref: "/auto/sell",
  },
  whyChooseUs: {
    title: "Why Choose True Goshen",
    description:
      "We built our process around transparency and accountability — the qualities that matter when purchasing a vehicle.",
    cards: [
      {
        icon: "BadgeCheck",
        title: "Verified Vehicles",
        description:
          "Every vehicle undergoes identity verification, title checks, and odometer validation before listing.",
      },
      {
        icon: "SearchCheck",
        title: "Thorough Inspections",
        description:
          "Our 150-point inspection covers mechanical, structural, and cosmetic condition with documented results.",
      },
      {
        icon: "Calculator",
        title: "Flexible Financing",
        description:
          "Competitive rates with multiple lender options. Pre-qualification available without impacting your credit score.",
      },
      {
        icon: "Truck",
        title: "Nationwide Delivery",
        description:
          "Professional transport to your location with full insurance coverage and delivery tracking.",
      },
      {
        icon: "Headphones",
        title: "Customer Support",
        description:
          "Dedicated advisors available throughout your purchase, from initial inquiry through post-delivery follow-up.",
      },
    ],
  },
  browseByCategory: {
    title: "Browse by Category",
    description: "Explore our inventory organized by vehicle type.",
    videoUrl: "",
    videoEmbedUrl: "",
    videoAspect: "16:9",
    videoSize: "lg",
    videoObjectFit: "cover",
    embedMinimalBranding: true,
    embedHideControls: true,
    embedHideRelated: true,
    backgroundImage: "",
    categories: [
      { id: "suv", label: "SUVs", slug: "SUV", href: "", image: "", icon: "" },
      { id: "sedan", label: "Sedans", slug: "Sedan", href: "", image: "", icon: "" },
      {
        id: "luxury",
        label: "Luxury Vehicles",
        slug: "Luxury",
        href: "",
        image: "",
        icon: "",
      },
      { id: "truck", label: "Trucks", slug: "Truck", href: "", image: "", icon: "" },
      {
        id: "commercial",
        label: "Commercial Vehicles",
        slug: "Commercial",
        href: "",
        image: "",
        icon: "",
      },
      {
        id: "electric",
        label: "Electric Vehicles",
        slug: "Electric",
        href: "",
        image: "",
        icon: "",
      },
      {
        id: "chinese",
        label: "Chinese Brands",
        slug: "SUV",
        href: "/auto/inventory?chinese=1",
        image: "",
        icon: "",
      },
    ],
  },
  testimonials: {
    title: "Customer Testimonials",
    description: "Feedback from customers who purchased through True Goshen Auto.",
    items: [
      {
        id: "1",
        name: "Kwame Asante",
        location: "Accra, Ghana",
        vehicle: "2024 BYD Atto 3",
        rating: 5,
        quote:
          "True Goshen made buying my electric SUV straightforward. Transparent pricing, no pressure, and the vehicle was exactly as described. Delivery to Accra was seamless.",
        image: "",
        verified: true,
      },
      {
        id: "2",
        name: "Ama Osei",
        location: "Kumasi, Ghana",
        vehicle: "2024 BYD Seal",
        rating: 5,
        quote:
          "I appreciated the thorough inspection report and battery health verification. Financing was explained clearly, and I felt confident throughout the entire process.",
        image: "",
        verified: true,
      },
      {
        id: "3",
        name: "David Martinez",
        location: "Tema, Ghana",
        vehicle: "2023 Ford F-150",
        rating: 5,
        quote:
          "Sold my truck through True Goshen and bought a newer model the same week. Fair appraisal, professional team, and excellent follow-up after the sale.",
        image: "",
        verified: true,
      },
      {
        id: "4",
        name: "Jennifer Mensah",
        location: "Takoradi, Ghana",
        vehicle: "2023 Geely Coolray",
        rating: 5,
        quote:
          "Nationwide delivery worked perfectly. The car arrived detailed and ready to drive. Customer support answered every question before I committed.",
        image: "",
        verified: true,
      },
    ],
  },
  corporateHomepage: DEFAULT_CORPORATE_HOMEPAGE,
  corporateServices: DEFAULT_CORPORATE_SERVICES,
  corporateStats: DEFAULT_CORPORATE_STATS,
  corporateFaq: DEFAULT_CORPORATE_FAQ,
  corporateServicesPage: DEFAULT_CORPORATE_SERVICES_PAGE,
  freightLanding: DEFAULT_FREIGHT_LANDING,
  shippingConsultation: DEFAULT_SHIPPING_CONSULTATION,
  sparePartsLanding: DEFAULT_SPARE_PARTS_LANDING,
  corporateDivisions: DEFAULT_CORPORATE_DIVISIONS,
  inventoryPage: DEFAULT_INVENTORY_PAGE,
  freightTracking: DEFAULT_FREIGHT_TRACKING_PAGE,
  corporateTestimonials: {
    title: "What Our Clients Say",
    description:
      "Feedback from businesses and individuals who rely on True Goshen for imports, freight, and parts.",
    items: [
      {
        id: "c1",
        name: "Samuel Boateng",
        location: "Accra, Ghana",
        vehicle: "Vehicle Import",
        rating: 5,
        quote:
          "True Goshen handled our fleet import from start to finish — documentation, clearing, and delivery were coordinated under one roof. Professional team and clear communication throughout.",
        image: "",
        verified: true,
      },
      {
        id: "c2",
        name: "Grace Adjei",
        location: "Kumasi, Ghana",
        vehicle: "Freight & Clearing",
        rating: 5,
        quote:
          "Their freight and customs team kept us updated at every port milestone. Our container cleared on schedule with no surprises on duties or paperwork.",
        image: "",
        verified: true,
      },
      {
        id: "c3",
        name: "Emmanuel Darko",
        location: "Tema, Ghana",
        vehicle: "Genuine Spare Parts",
        rating: 5,
        quote:
          "We source OEM and aftermarket parts through True Goshen regularly. Genuine stock, fair pricing, and reliable delivery — exactly what our workshop needs.",
        image: "",
        verified: true,
      },
      {
        id: "c4",
        name: "Patricia Owusu",
        location: "Takoradi, Ghana",
        vehicle: "Logistics & Support",
        rating: 5,
        quote:
          "From shipping consultation to final delivery, the True Goshen team treated our shipment like their own. Responsive support and a partner we trust for repeat business.",
        image: "",
        verified: true,
      },
    ],
  },
  about: {
    eyebrow: "About True Goshen Auto",
    heroTitle: "Built on Trust, Driven by Quality",
    heroSubtitle:
      "True Goshen Auto was founded with a simple belief: buying a vehicle should feel safe, transparent, and professional. We combine rigorous inspection standards with honest communication to earn your confidence.",
    promoVideoTitle: "",
    promoVideoUrl: "",
    promoVideoEmbedUrl: "",
    videoAspect: "16:9",
    videoSize: "lg",
    videoObjectFit: "cover",
    embedMinimalBranding: true,
    embedHideControls: true,
    embedHideRelated: true,
    missionTitle: "Our Mission",
    missionDescription:
      "To provide a safe, reliable marketplace where every customer can purchase a quality vehicle with complete confidence in the process and the product.",
    missionBody:
      "We understand that a vehicle purchase is one of the most significant financial decisions most people make. That is why we invest in thorough inspections, verified vehicle histories, and a team that prioritizes your interests over quick sales.",
    missionImage: "",
    valuesTitle: "What We Stand For",
    values: [
      {
        icon: "Shield",
        title: "Trust & Transparency",
        description:
          "Every vehicle listing includes verified history, documented inspections, and clear pricing with no hidden fees.",
      },
      {
        icon: "Award",
        title: "Quality Standards",
        description:
          "Our 150-point inspection process ensures every vehicle meets rigorous mechanical and safety standards before listing.",
      },
      {
        icon: "Users",
        title: "Customer Commitment",
        description:
          "Dedicated advisors guide you from first inquiry through delivery and follow-up, with no high-pressure sales tactics.",
      },
      {
        icon: "Handshake",
        title: "Community Focus",
        description:
          "Based in Accra, Ghana, we serve customers across the country with the same level of care and professionalism.",
      },
    ],
    qualityTitle: "Vehicle Quality Standards",
    qualityDescription: "Every vehicle in our inventory passes a comprehensive evaluation.",
    qualityBullets: [
      "150-point mechanical and cosmetic inspection",
      "Title and ownership verification",
      "Odometer and VIN validation",
      "Complete service history review when available",
      "Road test and diagnostic scan",
      "Professional detailing before delivery",
    ],
    qualityImage: "",
  },
  footer: {
    tagline:
      "Your Safe Place for Quality Vehicles. Verified inventory, transparent pricing, and professional service you can trust.",
    addressLine1: SITE_ADDRESS_LINE1,
    addressLine2: SITE_ADDRESS_LINE2,
    phone: SITE_PHONE_DISPLAY,
    phoneTel: SITE_PHONE_INTL,
    email: SITE_EMAIL,
    mapsUrl: GOOGLE_MAPS_URL,
    newsletterDescription: "Receive new inventory alerts and exclusive offers.",
    socialFacebook: "",
    socialInstagram: "",
    socialLinkedIn: "",
  },
  header: {
    navLinks: [
      { href: "/auto/buy", label: "Buy" },
      { href: "/auto/sell", label: "Sell" },
      { href: "/auto/inventory?status=pre_order", label: "Pre-Order" },
      { href: "/auto/inventory", label: "Inventory" },
      { href: "/auto/financing", label: "Financing" },
      { href: "/auto/spare-parts", label: "Spare Parts" },
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
    ],
  },
  contact: {
    heroTitle: "Contact Us",
    heroSubtitle:
      "Reach out to our team for vehicle inquiries, financing questions, or to schedule an inspection.",
    hoursWeekday: "Mon–Fri: 9:00 AM – 7:00 PM",
    hoursSaturday: "Sat: 9:00 AM – 5:00 PM",
    hoursSunday: "Sun: Closed",
  },
  buy: {
    title: "Buy a Vehicle",
    subtitle:
      "A straightforward process designed to help you find the right vehicle with complete transparency — buy in stock or pre-order with a 25% down payment.",
  },
  sell: {
    title: "Sell Your Vehicle",
    subtitle:
      "Receive a fair market appraisal and sell your vehicle through our trusted platform or trade toward your next purchase.",
  },
  financing: {
    eyebrow: "Financing",
    title: "Flexible Financing Options",
    subtitle:
      "Competitive rates from trusted lending partners. Pre-qualify without affecting your credit score.",
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const LEGACY_NAV_HREF: Record<string, string> = {
  "/buy": "/auto/buy",
  "/sell": "/auto/sell",
  "/inventory": "/auto/inventory",
  "/financing": "/auto/financing",
  "/garage": "/auto/garage",
  "/spare-parts": "/auto/spare-parts",
};

const CORE_AUTO_NAV_LINKS: SiteContentNavLink[] = [
  { href: "/auto/buy", label: "Buy" },
  { href: "/auto/sell", label: "Sell" },
  { href: "/auto/inventory?status=pre_order", label: "Pre-Order" },
];

function navLinkKey(href: string): string | null {
  const normalizedHref = LEGACY_NAV_HREF[href] ?? href;
  try {
    const url = new URL(normalizedHref, "http://local");
    if (url.pathname === "/auto/buy") return "buy";
    if (url.pathname === "/auto/sell") return "sell";
    if (
      url.pathname === "/auto/inventory" &&
      url.searchParams.get("status") === "pre_order"
    ) {
      return "preorder";
    }
    return null;
  } catch {
    return null;
  }
}

/** Keep Buy, Sell, Pre-Order, and About Us visible after CMS overrides or legacy route migrations. */
export function normalizeHeaderNavLinks(links: SiteContentNavLink[]): SiteContentNavLink[] {
  const aboutHref = "/about";
  const contactHref = "/contact";
  let about: SiteContentNavLink | undefined;
  let contact: SiteContentNavLink | undefined;
  const other: SiteContentNavLink[] = [];

  for (const link of links) {
    const href = LEGACY_NAV_HREF[link.href] ?? link.href;
    if (navLinkKey(href)) continue;
    if (href === aboutHref) {
      about = { ...link, href: aboutHref, label: link.label.trim() || "About Us" };
      continue;
    }
    if (href === contactHref) {
      contact = { ...link, href: contactHref, label: link.label.trim() || "Contact" };
      continue;
    }
    other.push({ ...link, href });
  }

  return [
    ...CORE_AUTO_NAV_LINKS,
    about ?? { href: aboutHref, label: "About Us" },
    ...other,
    ...(contact ? [contact] : [{ href: contactHref, label: "Contact" }]),
  ];
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Merge saved category rows by id so custom images survive partial DB updates. */
function mergeBrowseByCategoryCards(
  defaults: BrowseByCategoryCard[],
  patch: unknown[]
): BrowseByCategoryCard[] {
  const patchById = new Map<string, Record<string, unknown>>();
  for (const item of patch) {
    if (isPlainObject(item) && typeof item.id === "string") {
      patchById.set(item.id, item);
    }
  }

  return defaults.map((def) => {
    const saved = patchById.get(def.id);
    if (!saved) return def;

    const customImage =
      asTrimmedString(saved.image) ||
      asTrimmedString(saved.imageUrl) ||
      asTrimmedString(saved.customImage);

    return {
      ...def,
      label: asTrimmedString(saved.label) || def.label,
      slug: asTrimmedString(saved.slug) || def.slug,
      href: asTrimmedString(saved.href) ?? def.href,
      icon: (asTrimmedString(saved.icon) || def.icon) as BrowseByCategoryCard["icon"],
      image: customImage || def.image,
    };
  });
}

function deepMergeSection<T extends Record<string, unknown>>(defaults: T, patch: unknown): T {
  if (!isPlainObject(patch)) return defaults;
  const result = { ...defaults };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = result[key];
    if (Array.isArray(value)) {
      if (key === "categories" && Array.isArray(current)) {
        result[key as keyof T] = mergeBrowseByCategoryCards(
          current as BrowseByCategoryCard[],
          value
        ) as T[keyof T];
      } else if (key === "cards" && Array.isArray(current)) {
        const defCards = current as Array<{ id: string }>;
        if (defCards[0] && "icon" in defCards[0]) {
          result[key as keyof T] = mergeDivisionLandingCards(
            current as import("@/lib/site-content/corporate-defaults").DivisionLandingCard[],
            value
          ) as T[keyof T];
        } else if (defCards[0] && "image" in defCards[0]) {
          result[key as keyof T] = mergeCorporateServiceCards(
            current as import("@/lib/site-content/corporate-defaults").CorporateServiceCard[],
            value
          ) as T[keyof T];
        } else {
          result[key as keyof T] = value as T[keyof T];
        }
      } else if (key === "items" && Array.isArray(current)) {
        const defItems = current as Array<{ id: string }>;
        if (defItems[0] && "value" in defItems[0]) {
          result[key as keyof T] = mergeCorporateStatItems(
            current as import("@/lib/site-content/corporate-defaults").CorporateStatItem[],
            value
          ) as T[keyof T];
        } else if (defItems[0] && "question" in defItems[0]) {
          result[key as keyof T] = mergeCorporateFaqItems(
            current as import("@/lib/site-content/corporate-defaults").CorporateFaqItem[],
            value
          ) as T[keyof T];
        } else {
          result[key as keyof T] = value as T[keyof T];
        }
      } else if (key === "aboutSpecialties") {
        result[key as keyof T] = value as T[keyof T];
      } else {
        result[key as keyof T] = value as T[keyof T];
      }
    } else if (isPlainObject(current) && isPlainObject(value)) {
      result[key as keyof T] = deepMergeSection(
        current as Record<string, unknown>,
        value
      ) as T[keyof T];
    } else {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

export function mergeSiteContent(patch: Partial<Record<SiteContentSection, unknown>>): SiteContent {
  const merged: SiteContent = { ...DEFAULT_SITE_CONTENT };
  for (const section of SITE_CONTENT_SECTIONS) {
    if (patch[section] !== undefined) {
      (merged as Record<SiteContentSection, SiteContent[SiteContentSection]>)[section] =
        deepMergeSection(
          DEFAULT_SITE_CONTENT[section] as Record<string, unknown>,
          patch[section]
        ) as SiteContent[SiteContentSection];
    }
  }
  merged.header = {
    ...merged.header,
    navLinks: normalizeHeaderNavLinks(merged.header.navLinks),
  };
  return merged;
}

export function sectionToDbKey(section: SiteContentSection): string {
  return SECTION_DB_KEYS[section];
}

export function dbKeyToSection(dbKey: string): SiteContentSection | null {
  const normalized = dbKey.trim();
  const mapped = DB_TO_SECTION[normalized];
  if (mapped) return mapped;
  if ((SITE_CONTENT_SECTIONS as readonly string[]).includes(normalized)) {
    return normalized as SiteContentSection;
  }
  return null;
}
