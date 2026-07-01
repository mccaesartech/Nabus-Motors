import {
  BarChart3,
  Calendar,
  Car,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Mail,
  Package,
  Palette,
  Settings,
  Ship,
  ShoppingCart,
  Tags,
  Trash2,
  Truck,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { platformPath } from "./paths";

export type PlatformNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type PlatformNavGroup = {
  label?: string;
  items: PlatformNavItem[];
};

const dashboard: PlatformNavItem = {
  label: "Dashboard",
  href: platformPath("dashboard"),
  icon: LayoutDashboard,
  description: "Overview & stats",
};

const autoGroup: PlatformNavGroup = {
  label: "AUTO",
  items: [
    {
      label: "Inventory",
      href: platformPath("inventory"),
      icon: Car,
      description: "Your vehicles",
    },
    {
      label: "Customers",
      href: platformPath("customers"),
      icon: Users,
      description: "Buyer profiles",
    },
    {
      label: "Sales",
      href: platformPath("sales"),
      icon: ShoppingCart,
      description: "Deals & quotes",
    },
    {
      label: "Finance",
      href: platformPath("finance"),
      icon: CreditCard,
      description: "Loan applications",
    },
    {
      label: "Leads",
      href: platformPath("leads"),
      icon: MessageSquare,
      description: "Pre-orders & inquiries",
    },
    {
      label: "Appointments",
      href: platformPath("appointments"),
      icon: Calendar,
      description: "Viewings & test drives",
    },
    {
      label: "Import Tracking",
      href: platformPath("tracking"),
      icon: Truck,
      description: "Vehicle shipment status",
    },
    {
      label: "Documents",
      href: platformPath("documents"),
      icon: FileText,
      description: "Contracts and files",
    },
  ],
};

const freightGroup: PlatformNavGroup = {
  label: "FREIGHT",
  items: [
    {
      label: "Freight Orders",
      href: platformPath("freight/orders"),
      icon: Ship,
      description: "Active shipments",
    },
    {
      label: "Quote Requests",
      href: platformPath("freight/quotes"),
      icon: MessageSquare,
      description: "Inbound freight quotes",
    },
    {
      label: "Freight Tracking",
      href: platformPath("freight/tracking"),
      icon: Truck,
      description: "Shipment timeline",
    },
    {
      label: "Freight Documents",
      href: platformPath("freight/documents"),
      icon: FileText,
      description: "BOL, customs, invoices",
    },
  ],
};

const partsGroup: PlatformNavGroup = {
  label: "AUTO PARTS",
  items: [
    {
      label: "Categories",
      href: platformPath("parts/categories"),
      icon: Tags,
      description: "Parts taxonomy",
    },
    {
      label: "Parts Inventory",
      href: platformPath("parts/inventory"),
      icon: Package,
      description: "Stock & SKUs",
    },
    {
      label: "Draft & Published",
      href: platformPath("parts/published"),
      icon: FileText,
      description: "Catalogue workflow",
    },
  ],
};

const platformGroup: PlatformNavGroup = {
  label: "PLATFORM",
  items: [
    {
      label: "Messages",
      href: platformPath("messages"),
      icon: MessageSquare,
      description: "Logged-in customer chat",
    },
    {
      label: "Emails",
      href: platformPath("emails"),
      icon: Mail,
      description: "Sent & received correspondence",
    },
    {
      label: "Team Messages",
      href: platformPath("team-chat"),
      icon: MessagesSquare,
      description: "Internal staff chat",
    },
    {
      label: "Reports",
      href: platformPath("reports"),
      icon: BarChart3,
      description: "Business intelligence",
    },
    {
      label: "Trash",
      href: platformPath("trash"),
      icon: Trash2,
      description: "Deleted items & restore",
    },
    {
      label: "Users",
      href: platformPath("users"),
      icon: UserCog,
      description: "Team and permissions",
    },
    {
      label: "Site Content",
      href: platformPath("site-content"),
      icon: Palette,
      description: "Edit public website copy & images",
    },
    {
      label: "Settings",
      href: platformPath("settings"),
      icon: Settings,
      description: "Platform configuration",
    },
  ],
};

export const PLATFORM_NAV_GROUPS: PlatformNavGroup[] = [
  { items: [dashboard] },
  autoGroup,
  freightGroup,
  partsGroup,
  platformGroup,
];

/** Flat list for page title resolution and search */
export const PLATFORM_NAV: PlatformNavItem[] = PLATFORM_NAV_GROUPS.flatMap((g) => g.items);
