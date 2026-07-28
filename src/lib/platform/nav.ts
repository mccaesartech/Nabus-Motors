import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  Car,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Mail,
  Megaphone,
  Package,
  Palette,
  Settings,
  ShieldAlert,
  Ship,
  ShoppingCart,
  Tags,
  Trash2,
  Truck,
  Users,
  UserCog,
  UserX,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { platformPath } from "./paths";

export type PlatformNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  groupId?: string;
};

export type PlatformNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: PlatformNavItem[];
  defaultExpanded?: boolean;
};

const dashboard: PlatformNavItem = {
  label: "Dashboard",
  href: platformPath("dashboard"),
  icon: LayoutDashboard,
  description: "Overview & business health",
  groupId: "dashboard",
};

const salesGroup: PlatformNavGroup = {
  id: "sales",
  label: "Sales",
  icon: ShoppingCart,
  defaultExpanded: true,
  items: [
    {
      label: "Sales",
      href: platformPath("sales"),
      icon: ShoppingCart,
      description: "Deals & quotes",
      groupId: "sales",
    },
    {
      label: "Leads",
      href: platformPath("leads"),
      icon: MessageSquare,
      description: "Pre-orders & inquiries",
      groupId: "sales",
    },
    {
      label: "Appointments",
      href: platformPath("appointments"),
      icon: Calendar,
      description: "Viewings & test drives",
      groupId: "sales",
    },
  ],
};

const operationsGroup: PlatformNavGroup = {
  id: "operations",
  label: "Operations",
  icon: Wrench,
  items: [
    {
      label: "Import Tracking",
      href: platformPath("tracking"),
      icon: Truck,
      description: "Vehicle shipment status",
      groupId: "operations",
    },
    {
      label: "Documents",
      href: platformPath("documents"),
      icon: FileText,
      description: "Contracts and files",
      groupId: "operations",
    },
  ],
};

const inventoryGroup: PlatformNavGroup = {
  id: "inventory",
  label: "Inventory",
  icon: Car,
  items: [
    {
      label: "Inventory",
      href: platformPath("inventory"),
      icon: Car,
      description: "Your vehicles",
      groupId: "inventory",
    },
    {
      label: "Movement Ledger",
      href: platformPath("inventory/movements"),
      icon: ArrowLeftRight,
      description: "In/out records & financial trace",
      groupId: "inventory",
    },
  ],
};

const freightGroup: PlatformNavGroup = {
  id: "freight",
  label: "Freight",
  icon: Ship,
  items: [
    {
      label: "Freight Orders",
      href: platformPath("freight/orders"),
      icon: Ship,
      description: "Active shipments",
      groupId: "freight",
    },
    {
      label: "Quote Requests",
      href: platformPath("freight/quotes"),
      icon: MessageSquare,
      description: "Inbound freight quotes",
      groupId: "freight",
    },
    {
      label: "Freight Tracking",
      href: platformPath("freight/tracking"),
      icon: Truck,
      description: "Shipment timeline",
      groupId: "freight",
    },
    {
      label: "Freight Documents",
      href: platformPath("freight/documents"),
      icon: FileText,
      description: "BOL, customs, invoices",
      groupId: "freight",
    },
  ],
};

const partsGroup: PlatformNavGroup = {
  id: "parts",
  label: "Spare Parts",
  icon: Package,
  items: [
    {
      label: "Categories",
      href: platformPath("parts/categories"),
      icon: Tags,
      description: "Parts taxonomy",
      groupId: "parts",
    },
    {
      label: "Parts Inventory",
      href: platformPath("parts/inventory"),
      icon: Package,
      description: "Stock & SKUs",
      groupId: "parts",
    },
    {
      label: "Draft & Published",
      href: platformPath("parts/published"),
      icon: FileText,
      description: "Catalogue workflow",
      groupId: "parts",
    },
  ],
};

const financeGroup: PlatformNavGroup = {
  id: "finance",
  label: "Finance",
  icon: CreditCard,
  items: [
    {
      label: "Finance",
      href: platformPath("finance"),
      icon: CreditCard,
      description: "Loan applications",
      groupId: "finance",
    },
  ],
};

const marketingGroup: PlatformNavGroup = {
  id: "marketing",
  label: "Marketing",
  icon: Megaphone,
  items: [
    {
      label: "Reports",
      href: platformPath("reports"),
      icon: BarChart3,
      description: "Business intelligence",
      groupId: "marketing",
    },
    {
      label: "Site Content",
      href: platformPath("site-content"),
      icon: Palette,
      description: "Edit public website copy & images",
      groupId: "marketing",
    },
  ],
};

const customersGroup: PlatformNavGroup = {
  id: "customers",
  label: "Customers",
  icon: Users,
  items: [
    {
      label: "Customers",
      href: platformPath("customers"),
      icon: Users,
      description: "Buyer profiles",
      groupId: "customers",
    },
    {
      label: "Messages",
      href: platformPath("messages"),
      icon: MessageSquare,
      description: "Logged-in customer chat",
      groupId: "customers",
    },
  ],
};

const administrationGroup: PlatformNavGroup = {
  id: "administration",
  label: "Administration",
  icon: Settings,
  items: [
    {
      label: "Team Messages",
      href: platformPath("team-chat"),
      icon: MessagesSquare,
      description: "Internal staff chat",
      groupId: "administration",
    },
    {
      label: "Emails",
      href: platformPath("emails"),
      icon: Mail,
      description: "Sent & received correspondence",
      groupId: "administration",
    },
    {
      label: "Account Lifecycle",
      href: platformPath("account-lifecycle"),
      icon: UserX,
      description: "Deletion requests & retention",
      groupId: "administration",
    },
    {
      label: "Trash",
      href: platformPath("trash"),
      icon: Trash2,
      description: "Deleted items & restore",
      groupId: "administration",
    },
    {
      label: "Users",
      href: platformPath("users"),
      icon: UserCog,
      description: "Team and permissions",
      groupId: "administration",
    },
    {
      label: "Error Log",
      href: platformPath("error-log"),
      icon: ShieldAlert,
      description: "Handled failures & support references",
      groupId: "administration",
    },
    {
      label: "Settings",
      href: platformPath("settings"),
      icon: Settings,
      description: "Platform configuration",
      groupId: "administration",
    },
  ],
};

/** Standalone dashboard entry (not inside an expandable group). */
export const PLATFORM_DASHBOARD_ITEM: PlatformNavItem = dashboard;

/** Department-grouped navigation for the admin sidebar. */
export const PLATFORM_NAV_DEPARTMENTS: PlatformNavGroup[] = [
  salesGroup,
  operationsGroup,
  inventoryGroup,
  freightGroup,
  partsGroup,
  financeGroup,
  marketingGroup,
  customersGroup,
  administrationGroup,
];

/** Legacy flat groups — kept for page title resolution compatibility. */
export const PLATFORM_NAV_GROUPS: PlatformNavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, items: [dashboard] },
  ...PLATFORM_NAV_DEPARTMENTS,
];

/** Flat list for page title resolution and search */
export const PLATFORM_NAV: PlatformNavItem[] = [
  dashboard,
  ...PLATFORM_NAV_DEPARTMENTS.flatMap((g) => g.items),
];

/** Route → department group mapping for documentation and active-section highlighting. */
export const ROUTE_TO_DEPARTMENT: Record<string, string> = Object.fromEntries(
  PLATFORM_NAV.filter((item) => item.groupId).map((item) => [item.href, item.groupId!])
);
