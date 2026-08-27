import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  Car,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Mail,
  Megaphone,
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
  /** Related search aliases / synonyms (matched from 3+ char queries). */
  keywords?: string[];
  groupId?: string;
};

export type PlatformNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: PlatformNavItem[];
};

const dashboard: PlatformNavItem = {
  label: "Dashboard",
  href: platformPath("dashboard"),
  icon: LayoutDashboard,
  description: "Overview & business health",
  keywords: ["home","overview","stats","metrics","kpi"],
  groupId: "dashboard",
};

const customers: PlatformNavItem = {
  label: "Customers",
  href: platformPath("customers"),
  icon: Users,
  description: "Buyer profiles & contacts",
  keywords: ["buyers","clients","contacts","crm","people"],
  groupId: "customers",
};

const salesGroup: PlatformNavGroup = {
  id: "sales",
  label: "Sales",
  icon: ShoppingCart,
  items: [
    {
      label: "Sales",
      href: platformPath("sales"),
      icon: ShoppingCart,
      description: "Deals & quotes",
      keywords: ["deals","quotes","cart","orders","selling","pipeline"],
      groupId: "sales",
    },
    {
      label: "Leads",
      href: platformPath("leads"),
      icon: MessageSquare,
      description: "Pre-orders & inquiries",
      keywords: ["preorders","pre-orders","inquiries","prospects","pipeline"],
      groupId: "sales",
    },
    {
      label: "Appointments",
      href: platformPath("appointments"),
      icon: Calendar,
      description: "Viewings & test drives",
      keywords: ["viewings","test drives","calendar","schedule","bookings"],
      groupId: "sales",
    },
    {
      label: "Messages",
      href: platformPath("messages"),
      icon: MessageSquare,
      description: "Logged-in customer chat",
      keywords: ["chat","inbox","customer chat","conversations"],
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
      keywords: ["shipment","shipping","tracking","vehicles","status","logistics"],
      groupId: "operations",
    },
    {
      label: "Documents",
      href: platformPath("documents"),
      icon: FileText,
      description: "Contracts and files",
      keywords: ["contracts","files","papers","pdf","attachments"],
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
      keywords: ["vehicles","cars","stock","catalogue","fleet"],
      groupId: "inventory",
    },
    {
      label: "Movement Ledger",
      href: platformPath("inventory/movements"),
      icon: ArrowLeftRight,
      description: "In/out records & financial trace",
      keywords: ["movements","in out","trace","ledger","financial"],
      groupId: "inventory",
    },
    {
      label: "AI Usage",
      href: platformPath("inventory/ai-usage"),
      icon: History,
      description: "AI Editor history & cleanup",
      keywords: ["ai editor","history","cleanup","usage","credits"],
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
      keywords: ["orders","shipments","shipping","freight","cargo","booking"],
      groupId: "freight",
    },
    {
      label: "Quote Requests",
      href: platformPath("freight/quotes"),
      icon: MessageSquare,
      description: "Inbound freight quotes",
      keywords: ["quotes","freight quotes","inbound","rfq"],
      groupId: "freight",
    },
    {
      label: "Freight Tracking",
      href: platformPath("freight/tracking"),
      icon: Truck,
      description: "Shipment timeline",
      keywords: ["shipment","timeline","shipping status","cargo"],
      groupId: "freight",
    },
    {
      label: "Freight Documents",
      href: platformPath("freight/documents"),
      icon: FileText,
      description: "BOL, customs, invoices",
      keywords: ["bol","customs","invoices","paperwork","shipping docs"],
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
      keywords: ["taxonomy","parts categories","tags","classification"],
      groupId: "parts",
    },
    {
      label: "Parts Inventory",
      href: platformPath("parts/inventory"),
      icon: Package,
      description: "Stock & SKUs",
      keywords: ["parts","stock","skus","spares","components"],
      groupId: "parts",
    },
    {
      label: "Draft & Published",
      href: platformPath("parts/published"),
      icon: FileText,
      description: "Catalogue workflow",
      keywords: ["catalogue","catalog","publish","drafts","parts listing"],
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
      keywords: ["loans","credit","applications","financing","lending"],
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
      keywords: ["analytics","bi","intelligence","charts","insights"],
      groupId: "marketing",
    },
    {
      label: "Site Content",
      href: platformPath("site-content"),
      icon: Palette,
      description: "Edit public website copy & images",
      keywords: ["website","cms","copy","images","content","landing"],
      groupId: "marketing",
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
      keywords: ["staff chat","internal chat","team chat","slack"],
      groupId: "administration",
    },
    {
      label: "Emails",
      href: platformPath("emails"),
      icon: Mail,
      description: "Sent & received correspondence",
      keywords: ["mail","inbox","email","correspondence","smtp","mailbox"],
      groupId: "administration",
    },
    {
      label: "Account Lifecycle",
      href: platformPath("account-lifecycle"),
      icon: UserX,
      description: "Deletion requests & retention",
      keywords: ["deletion","retention","gdpr","close account","privacy"],
      groupId: "administration",
    },
    {
      label: "Trash",
      href: platformPath("trash"),
      icon: Trash2,
      description: "Deleted items & restore",
      keywords: ["deleted","recycle","bin","restore","recovery"],
      groupId: "administration",
    },
    {
      label: "Audit Log",
      href: platformPath("audit-log"),
      icon: ClipboardList,
      description: "Immutable activity trail",
      keywords: ["security","activity","trail","logs","history","compliance","ops"],
      groupId: "administration",
    },
    {
      label: "Users",
      href: platformPath("users"),
      icon: UserCog,
      description: "Team and permissions",
      keywords: ["team","staff","admin","admins","accounts","permissions","roles","members","admin users"],
      groupId: "administration",
    },
    {
      label: "Settings",
      href: platformPath("settings"),
      icon: Settings,
      description: "Platform configuration",
      keywords: ["fx","rate","rates","currency","exchange","config","configuration","preferences","setup"],
      groupId: "administration",
    },
  ],
};

/** Standalone dashboard entry (not inside an expandable group). */
export const PLATFORM_DASHBOARD_ITEM: PlatformNavItem = dashboard;

/** Standalone customers entry — top-level for quick access (not inside an expandable group). */
export const PLATFORM_CUSTOMERS_ITEM: PlatformNavItem = customers;

/** Department-grouped navigation for the admin sidebar. */
export const PLATFORM_NAV_DEPARTMENTS: PlatformNavGroup[] = [
  salesGroup,
  operationsGroup,
  inventoryGroup,
  freightGroup,
  partsGroup,
  financeGroup,
  marketingGroup,
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
  customers,
  ...PLATFORM_NAV_DEPARTMENTS.flatMap((g) => g.items),
];

/** Route → department group mapping for documentation and active-section highlighting. */
export const ROUTE_TO_DEPARTMENT: Record<string, string> = Object.fromEntries(
  PLATFORM_NAV.filter((item) => item.groupId).map((item) => [item.href, item.groupId!])
);
