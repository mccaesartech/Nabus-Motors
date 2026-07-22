import {
  Award,
  BadgeCheck,
  Calculator,
  CalendarCheck,
  Car,
  Clock,
  Compass,
  FileText,
  Globe,
  Handshake,
  Headphones,
  MessageCircle,
  MessageSquare,
  Package,
  SearchCheck,
  Shield,
  Ship,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export const SITE_CONTENT_ICONS = {
  BadgeCheck,
  SearchCheck,
  Calculator,
  Truck,
  Headphones,
  Shield,
  Users,
  Award,
  Handshake,
  Car,
  Ship,
  Package,
  MessageSquare,
  FileText,
  Globe,
  Compass,
  MessageCircle,
  Clock,
  CalendarCheck,
} as const;

export type SiteContentIconName = keyof typeof SITE_CONTENT_ICONS;

export const SITE_CONTENT_ICON_NAMES = Object.keys(
  SITE_CONTENT_ICONS
) as SiteContentIconName[];

export function resolveSiteContentIcon(name: string): LucideIcon {
  return SITE_CONTENT_ICONS[name as SiteContentIconName] ?? BadgeCheck;
}
