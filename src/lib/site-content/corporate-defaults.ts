import { CORPORATE_HERO_POSTER_URL, CORPORATE_HERO_VIDEO_URL } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";
import type { SiteContentIconName } from "@/lib/site-content-icons";

export type CorporateServiceCard = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image: string;
  imageAlt: string;
};

export type CorporateStatItem = {
  id: string;
  value: string;
  label: string;
};

export type CorporateFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type CorporateHomepageSiteContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroVideoUrl: string;
  heroPosterUrl: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  aboutTitle: string;
  aboutDescription: string;
  aboutSpecialties: string[];
  contactCtaTitle: string;
  contactCtaDescription: string;
  contactCtaPrimaryLabel: string;
  contactCtaPrimaryHref: string;
  contactCtaSecondaryLabel: string;
  contactCtaSecondaryHref: string;
};

export type CorporateServicesSiteContent = {
  title: string;
  description: string;
  cards: CorporateServiceCard[];
};

export type CorporateStatsSiteContent = {
  items: CorporateStatItem[];
};

export type CorporateFaqSiteContent = {
  title: string;
  description: string;
  items: CorporateFaqItem[];
};

export type DivisionLandingCard = {
  id: string;
  icon: SiteContentIconName;
  title: string;
  description: string;
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
};

export type DivisionLandingSiteContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  cards: DivisionLandingCard[];
};

export type PageHeroSiteContentSimple = {
  title: string;
  subtitle: string;
};

export type FreightTrackingFormCopy = {
  trackingNumberLabel: string;
  trackingNumberPlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  helpText: string;
  submitLabel: string;
  loadingLabel: string;
};

export type FreightTrackingSiteContent = PageHeroSiteContentSimple & {
  cards: DivisionLandingCard[];
  form: FreightTrackingFormCopy;
};

export type SparePartsLandingSiteContent = PageHeroSiteContentSimple & {
  cards: DivisionLandingCard[];
};

export const DEFAULT_CORPORATE_HOMEPAGE: CorporateHomepageSiteContent = {
  heroEyebrow: "True Goshen Company Limited",
  heroTitle: "Your Trusted Partner for Vehicles, Freight & Parts",
  heroSubtitle:
    "One company, multiple specialised divisions — delivering quality vehicles, seamless international logistics, and genuine spare parts to Ghana and beyond.",
  heroVideoUrl: CORPORATE_HERO_VIDEO_URL,
  heroPosterUrl: CORPORATE_HERO_POSTER_URL,
  ctaPrimaryLabel: "Explore Our Services",
  ctaPrimaryHref: ROUTES.corporate.services,
  ctaSecondaryLabel: "Contact Us",
  ctaSecondaryHref: ROUTES.corporate.contact,
  aboutTitle: "About the Company",
  aboutDescription:
    "True Goshen Company Limited is a Ghana-based enterprise specialising in automotive sales, international freight forwarding, and genuine spare parts — built on transparency, accountability, and customer trust.",
  aboutSpecialties: [
    "Vehicle import & pre-order from China, Japan, USA, UK, and UAE",
    "Freight forwarding, RoRo, and containerised shipping to Ghana",
    "Ghana Customs clearing and inland delivery coordination",
    "Genuine OEM and aftermarket spare parts supply",
    "Transparent pricing and dedicated customer support",
  ],
  contactCtaTitle: "Get in Touch",
  contactCtaDescription:
    "Reach our team for vehicle inquiries, freight quotes, spare parts, or shipping consultation.",
  contactCtaPrimaryLabel: "Contact Us",
  contactCtaPrimaryHref: ROUTES.corporate.contact,
  contactCtaSecondaryLabel: "Visit Auto Division",
  contactCtaSecondaryHref: ROUTES.auto.home,
};

export const DEFAULT_CORPORATE_SERVICES: CorporateServicesSiteContent = {
  title: "Our Services",
  description: "Four specialised divisions — tap a card to explore.",
  cards: [
    {
      id: "buy-vehicle",
      title: "Buy or Pre-Order a Vehicle",
      subtitle: "Browse stock or import from China, Japan & beyond",
      href: ROUTES.auto.home,
      image: "/images/services/buy-vehicle.jpg",
      imageAlt: "Vehicles available for purchase or pre-order",
    },
    {
      id: "freight",
      title: "Freight Forwarding & Customs Clearing",
      subtitle: "Shipping, documentation & Ghana customs — end to end",
      href: ROUTES.corporate.freight,
      image: "/images/services/freight-containers.jpg",
      imageAlt: "Aerial view of shipping containers at a freight terminal",
    },
    {
      id: "spare-parts",
      title: "Genuine Spare Parts",
      subtitle: "OEM and aftermarket parts for popular makes",
      href: ROUTES.auto.spareParts,
      image: "/images/services/spare-parts.jpg",
      imageAlt: "Genuine automotive spare parts",
    },
    {
      id: "shipping-consultation",
      title: "Shipping Consultation",
      subtitle: "Expert guidance on the right import option for you",
      href: ROUTES.corporate.shippingConsultation,
      image: "/images/services/shipping-consultation.jpg",
      imageAlt: "Logistics advisor reviewing shipping plans",
    },
  ],
};

export const DEFAULT_CORPORATE_STATS: CorporateStatsSiteContent = {
  items: [
    { id: "vehicles", value: "500+", label: "Vehicles Delivered" },
    { id: "countries", value: "15+", label: "Origin Countries" },
    { id: "satisfaction", value: "98%", label: "Customer Satisfaction" },
    { id: "support", value: "24/7", label: "Support Available" },
  ],
};

export const DEFAULT_CORPORATE_FAQ: CorporateFaqSiteContent = {
  title: "Frequently Asked Questions",
  description: "Quick answers about our services and how we work.",
  items: [
    {
      id: "divisions",
      question: "What divisions does True Goshen operate?",
      answer:
        "We operate four divisions: Auto (vehicle sales and pre-orders), Freight Forwarding & Clearing, Genuine Spare Parts, and Shipping Consultation for import logistics.",
    },
    {
      id: "preorder",
      question: "Can I pre-order a vehicle from China or Japan?",
      answer:
        "Yes. Through our Auto Division you can browse available stock or pre-order vehicles from China, Japan, and other markets. Our freight team handles shipping and clearing.",
    },
    {
      id: "clearing",
      question: "Do you handle customs clearing in Ghana?",
      answer:
        "Our Freight & Clearing division manages documentation, Ghana Customs liaison, port handling, and inland delivery coordination.",
    },
    {
      id: "parts",
      question: "How do I request spare parts?",
      answer:
        "Visit our Spare Parts marketplace under the Auto Division to browse published parts, or submit a request for parts not yet listed.",
    },
    {
      id: "tracking",
      question: "How can I track my shipment?",
      answer:
        "Use our shipment tracking page with your tracking number, or contact our freight team for status updates.",
    },
  ],
};

export const DEFAULT_CORPORATE_SERVICES_PAGE: DivisionLandingSiteContent = {
  heroEyebrow: "Our Divisions",
  heroTitle: "Services",
  heroSubtitle:
    "True Goshen Company Limited operates specialised divisions under one trusted brand — each focused on delivering transparency, quality, and reliable customer support.",
  cards: [
    {
      id: "auto",
      icon: "Car",
      title: "Auto Division — Buy & Pre-Order Vehicles",
      description:
        "Browse verified inventory, pre-order imports, flexible financing, and nationwide delivery through True Goshen Auto.",
      cta: "Enter Auto Division",
      href: ROUTES.auto.home,
      image: "/images/services/buy-vehicle.jpg",
      imageAlt: "Vehicles available for purchase or pre-order",
    },
    {
      id: "freight",
      icon: "Ship",
      title: "Freight Forwarding & Clearing",
      description:
        "Vehicle shipping, container logistics, documentation, and Ghana customs clearing from origin port to your doorstep.",
      cta: "Freight services",
      href: ROUTES.corporate.freight,
      image: "/images/services/freight-forwarding.jpg",
      imageAlt: "Container ship and freight logistics",
    },
    {
      id: "parts",
      icon: "Package",
      title: "Genuine Spare Parts",
      description:
        "OEM and aftermarket parts for popular vehicle makes — browse published catalogue or request specific components.",
      cta: "Browse spare parts",
      href: ROUTES.auto.spareParts,
      image: "/images/services/spare-parts.jpg",
      imageAlt: "Genuine automotive spare parts",
    },
    {
      id: "consultation",
      icon: "MessageSquare",
      title: "Shipping Consultation",
      description:
        "Expert guidance on import routes, shipping methods, timelines, and costs for vehicles and cargo to Ghana.",
      cta: "Request consultation",
      href: ROUTES.corporate.shippingConsultation,
      image: "/images/services/shipping-consultation.jpg",
      imageAlt: "Logistics advisor reviewing shipping plans",
    },
  ],
};

export const DEFAULT_FREIGHT_LANDING: DivisionLandingSiteContent = {
  heroEyebrow: "",
  heroTitle: "Freight Forwarding & Clearing",
  heroSubtitle:
    "True Goshen's freight division handles international vehicle and cargo logistics — from origin port to your doorstep in Ghana. Specialising in China and Japan vehicle imports, RoRo shipping, and full customs clearance.",
  cards: [
    {
      id: "vehicle-shipping",
      icon: "Ship",
      title: "Vehicle Shipping",
      description:
        "RoRo and containerised vehicle imports from the US, UK, Europe, UAE, China, and Japan to Ghana ports.",
      cta: "",
      href: "?service=vehicle_shipping#request-quote",
      image: "/images/services/vehicle-shipping.jpg",
      imageAlt: "Vehicles loaded for international RoRo shipping",
    },
    {
      id: "container",
      icon: "Truck",
      title: "Container Shipping",
      description:
        "Full and shared container options for vehicles, parts, and general cargo with end-to-end coordination.",
      cta: "",
      href: "?service=container_shipping#request-quote",
      image: "/images/services/container-shipping.jpg",
      imageAlt: "Shipping containers at a freight terminal",
    },
    {
      id: "documentation",
      icon: "FileText",
      title: "Documentation",
      description:
        "Bill of lading, customs declarations, insurance paperwork, and compliance support for smooth clearance.",
      cta: "",
      href: "?service=documentation#request-quote",
      image: "/images/services/documentation.jpg",
      imageAlt: "Freight documentation and customs paperwork",
    },
    {
      id: "clearing",
      icon: "Globe",
      title: "Clearing & Delivery",
      description:
        "Ghana Customs liaison, port handling, and inland delivery to Accra or your preferred location.",
      cta: "",
      href: "?service=clearing#request-quote",
      image: "/images/services/clearing-delivery.jpg",
      imageAlt: "Cargo clearing and inland delivery coordination",
    },
  ],
};

export const DEFAULT_SHIPPING_CONSULTATION: DivisionLandingSiteContent = {
  heroEyebrow: "",
  heroTitle: "Shipping Consultation",
  heroSubtitle:
    "Not sure which shipping method or route fits your import? Request a consultation and our freight advisors will guide you through options, costs, and timelines.",
  cards: [
    {
      id: "route",
      icon: "Compass",
      title: "Route planning",
      description: "Compare RoRo, container, and air freight options for your specific import.",
      cta: "",
      href: "#consultation-form",
      image: "/images/services/shipping-route-planning.jpg",
      imageAlt: "International shipping routes and logistics planning",
    },
    {
      id: "asia",
      icon: "Globe",
      title: "China & Japan imports",
      description: "Specialist guidance on sourcing, shipping, and clearing vehicles from Asia.",
      cta: "",
      href: "#consultation-form",
      image: "/images/services/china-japan-imports.jpg",
      imageAlt: "Vehicles imported from China and Japan",
    },
    {
      id: "advice",
      icon: "MessageCircle",
      title: "Personalised advice",
      description:
        "Speak with our logistics team about timelines, duties, and total landed cost.",
      cta: "",
      href: "#consultation-form",
      image: "/images/services/personalised-advice.jpg",
      imageAlt: "Freight advisor providing personalised import guidance",
    },
  ],
};

export const DEFAULT_SPARE_PARTS_LANDING: SparePartsLandingSiteContent = {
  title: "Genuine Spare Parts",
  subtitle:
    "Browse published parts from True Goshen Auto Parts. Request or purchase — our team confirms availability and pricing.",
  cards: [
    {
      id: "engine",
      icon: "Package",
      title: "Engine",
      description: "Blocks, gaskets, belts, and internal engine components",
      cta: "",
      href: `${ROUTES.auto.spareParts}?category=engine#parts-results`,
      image: "/images/services/spare-parts-engine.jpg",
      imageAlt: "Automotive engine components and parts",
    },
    {
      id: "transmission",
      icon: "Truck",
      title: "Transmission",
      description: "Gearboxes, clutches, torque converters, and drivetrain",
      cta: "",
      href: `${ROUTES.auto.spareParts}?category=transmission#parts-results`,
      image: "/images/services/spare-parts-transmission.jpg",
      imageAlt: "Vehicle transmission and drivetrain parts",
    },
    {
      id: "suspension",
      icon: "Shield",
      title: "Suspension",
      description: "Shocks, struts, control arms, and bushings",
      cta: "",
      href: `${ROUTES.auto.spareParts}?category=suspension#parts-results`,
      image: "/images/services/spare-parts-suspension.jpg",
      imageAlt: "Suspension and steering components",
    },
    {
      id: "electrical",
      icon: "BadgeCheck",
      title: "Electrical",
      description: "Alternators, starters, wiring harnesses, and sensors",
      cta: "",
      href: `${ROUTES.auto.spareParts}?category=electrical#parts-results`,
      image: "/images/services/spare-parts-electrical.jpg",
      imageAlt: "Automotive electrical parts and sensors",
    },
    {
      id: "body-parts",
      icon: "Car",
      title: "Body Parts",
      description: "Panels, bumpers, fenders, and structural components",
      cta: "",
      href: `${ROUTES.auto.spareParts}?category=body-parts#parts-results`,
      image: "/images/services/spare-parts-body.jpg",
      imageAlt: "Vehicle body panels and exterior parts",
    },
    {
      id: "filters",
      icon: "SearchCheck",
      title: "Filters",
      description: "Oil, air, fuel, and cabin air filters for all makes",
      cta: "",
      href: `${ROUTES.auto.spareParts}?category=filters#parts-results`,
      image: "/images/services/spare-parts-filters.jpg",
      imageAlt: "Automotive oil and air filters",
    },
  ],
};

export type CorporateDivisionsSiteContent = {
  title: string;
  description: string;
  cards: DivisionLandingCard[];
};

export const DEFAULT_CORPORATE_DIVISIONS: CorporateDivisionsSiteContent = {
  title: "True Goshen Company Limited",
  description:
    "One trusted parent company — three specialised divisions serving Ghana and beyond. Whether you are buying a vehicle, shipping imports, or sourcing genuine parts, we deliver with transparency and care.",
  cards: [
    {
      id: "auto",
      icon: "Car",
      title: "Buy a Vehicle",
      description:
        "Browse verified inventory, pre-order imports, and drive with confidence through True Goshen Auto.",
      cta: "View inventory",
      href: ROUTES.auto.inventory,
      image: "/images/services/buy-vehicle.jpg",
      imageAlt: "Vehicles available for purchase or pre-order",
    },
    {
      id: "freight",
      icon: "Ship",
      title: "Freight Forwarding & Clearing",
      description:
        "Vehicle shipping, container logistics, documentation, and Ghana customs clearing — handled by our freight team.",
      cta: "Explore freight",
      href: ROUTES.corporate.freight,
      image: "/images/services/freight-forwarding.jpg",
      imageAlt: "Container ship and freight logistics",
    },
    {
      id: "parts",
      icon: "Package",
      title: "Genuine Spare Parts",
      description:
        "Quality OEM and aftermarket parts for popular makes — sourced and supplied through True Goshen Auto Parts.",
      cta: "Browse parts",
      href: ROUTES.auto.spareParts,
      image: "/images/services/spare-parts.jpg",
      imageAlt: "Genuine automotive spare parts",
    },
  ],
};

export type InventoryPageSiteContent = {
  title: string;
  subtitle: string;
  preorderTitle: string;
  preorderSubtitle: string;
};

export const DEFAULT_INVENTORY_PAGE: InventoryPageSiteContent = {
  title: "Vehicle Inventory",
  subtitle: "Verified vehicles with transparent pricing and detailed inspection reports.",
  preorderTitle: "Pre-Order Vehicles",
  preorderSubtitle:
    "Reserve incoming vehicles with a 25% down payment. Browse pre-order listings below.",
};

export const DEFAULT_FREIGHT_TRACKING_FORM: FreightTrackingFormCopy = {
  trackingNumberLabel: "Tracking number",
  trackingNumberPlaceholder: "e.g. TG-2026-001234",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  phoneLabel: "Phone",
  phonePlaceholder: "+233…",
  helpText:
    "Look up by tracking number, quote reference (FQ-…), or email and phone together. Provide the contact details used when you submitted your quote or order.",
  submitLabel: "Track shipment",
  loadingLabel: "Looking up…",
};

export const DEFAULT_FREIGHT_TRACKING_PAGE: FreightTrackingSiteContent = {
  title: "Shipment Tracking",
  subtitle:
    "Track active shipments, or look up a freight quote by reference before a tracking number is assigned.",
  form: DEFAULT_FREIGHT_TRACKING_FORM,
  cards: [
    {
      id: "status",
      icon: "Package",
      title: "Real-time status",
      description: "See where your shipment is — from origin port to Ghana delivery.",
      cta: "",
      href: "#track-form",
      image: "/images/services/tracking-status.jpg",
      imageAlt: "Shipment status updates on a logistics dashboard",
    },
    {
      id: "vessel",
      icon: "Ship",
      title: "Port & vessel updates",
      description: "Track vessel departures, arrivals, and port handling milestones.",
      cta: "",
      href: "#track-form",
      image: "/images/services/tracking-vessel.jpg",
      imageAlt: "Cargo vessel at an international port",
    },
    {
      id: "advice",
      icon: "MessageCircle",
      title: "Personalised advice",
      description:
        "Speak with our logistics team about timelines, duties, and total landed cost.",
      cta: "",
      href: "#advice",
      image: "/images/services/personalised-advice.jpg",
      imageAlt: "Freight advisor providing personalised import guidance",
    },
    {
      id: "delivery",
      icon: "Truck",
      title: "Delivery coordination",
      description: "Clearing progress and inland delivery scheduling when your cargo lands.",
      cta: "",
      href: "#track-form",
      image: "/images/services/tracking-delivery.jpg",
      imageAlt: "Freight truck for inland delivery coordination",
    },
  ],
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeCardsById<T extends { id: string }>(
  defaults: T[],
  patch: unknown[],
  mapSaved: (def: T, saved: Record<string, unknown>) => T
): T[] {
  const patchById = new Map<string, Record<string, unknown>>();
  for (const item of patch) {
    if (isPlainObject(item) && typeof item.id === "string") {
      patchById.set(item.id, item);
    }
  }
  return defaults.map((def) => {
    const saved = patchById.get(def.id);
    return saved ? mapSaved(def, saved) : def;
  });
}

export function mergeCorporateServiceCards(
  defaults: CorporateServiceCard[],
  patch: unknown[]
): CorporateServiceCard[] {
  return mergeCardsById(defaults, patch, (def, saved) => ({
    ...def,
    title: asTrimmedString(saved.title) || def.title,
    subtitle: asTrimmedString(saved.subtitle) || def.subtitle,
    href: asTrimmedString(saved.href) || def.href,
    image:
      asTrimmedString(saved.image) ||
      asTrimmedString(saved.imageUrl) ||
      def.image,
    imageAlt: asTrimmedString(saved.imageAlt) || def.imageAlt,
  }));
}

export function mergeCorporateStatItems(
  defaults: CorporateStatItem[],
  patch: unknown[]
): CorporateStatItem[] {
  return mergeCardsById(defaults, patch, (def, saved) => ({
    ...def,
    value: asTrimmedString(saved.value) || def.value,
    label: asTrimmedString(saved.label) || def.label,
  }));
}

export function mergeCorporateFaqItems(
  defaults: CorporateFaqItem[],
  patch: unknown[]
): CorporateFaqItem[] {
  return mergeCardsById(defaults, patch, (def, saved) => ({
    ...def,
    question:
      asTrimmedString(saved.question) || asTrimmedString(saved.q) || def.question,
    answer: asTrimmedString(saved.answer) || asTrimmedString(saved.a) || def.answer,
  }));
}

export function mergeDivisionLandingCards(
  defaults: DivisionLandingCard[],
  patch: unknown[]
): DivisionLandingCard[] {
  return mergeCardsById(defaults, patch, (def, saved) => ({
    ...def,
    icon: (asTrimmedString(saved.icon) || def.icon) as SiteContentIconName,
    title: asTrimmedString(saved.title) || def.title,
    description: asTrimmedString(saved.description) || def.description,
    cta: asTrimmedString(saved.cta) ?? def.cta,
    href: asTrimmedString(saved.href) ?? def.href,
    image:
      asTrimmedString(saved.image) ||
      asTrimmedString(saved.imageUrl) ||
      def.image,
    imageAlt: asTrimmedString(saved.imageAlt) || def.imageAlt,
  }));
}
