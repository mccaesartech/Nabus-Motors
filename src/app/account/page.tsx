"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, MessageSquarePlus, Package, Send, Ship, ShoppingCart, CalendarCheck, Car, Truck, Search, Settings } from "lucide-react";
import { Container } from "@/components/shared/container";
import { ShipmentTimeline } from "@/components/shared/shipment-timeline";
import { ImportMilestoneTimeline } from "@/components/shared/import-milestone-timeline";
import { VisualShipmentTimeline } from "@/components/shared/visual-shipment-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/routes";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useRequireCustomerAuth } from "@/hooks/use-require-customer-auth";
import {
  customerAuthProviderLabel,
  formatMemberSince,
  resolveCustomerAvatarUrl,
} from "@/lib/customer/profile";
import { useCurrency } from "@/context/currency-context";
import { useCustomerChatRealtime } from "@/lib/customer/realtime";
import {
  CUSTOMER_MESSAGE_CATEGORIES,
  type CustomerChatMessage,
  type CustomerConversation,
  type CustomerInquirySummary,
} from "@/lib/customer/types";
import { cn } from "@/lib/utils";
import { shipmentStatusLabel } from "@/lib/platform/shipment";
import { formatCargoDisplay } from "@/lib/freight/cargo-options";
import type { CustomerCartSummary, PartsOrderSummary } from "@/lib/parts/cart-types";
import { AccountDashboardTiles } from "@/components/account/account-dashboard-tiles";
import { AccountCartSection } from "@/components/account/account-cart-section";
import { OrderHistorySection } from "@/components/account/order-history-section";
import { RecentOrderBanner } from "@/components/account/recent-order-banner";
import { BookVisitSection } from "@/components/account/book-visit-section";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountEmptyState } from "@/components/account/account-empty-state";
import { AccountNotificationsSection } from "@/components/account/account-notifications-section";
import { VehicleRequestsSection } from "@/components/account/vehicle-requests-section";
import { ProfileAvatarViewer } from "@/components/account/profile-avatar-viewer";
import { LogoutConfirmDialog } from "@/components/platform/confirm-dialog";
import { buildAccountAppointmentContext } from "@/lib/account/appointment-context";
import { useCustomerNotifications } from "@/context/customer-notifications-context";
import { useMarkCustomerNotificationsOnVisit } from "@/hooks/use-mark-customer-notifications-read";
import { accountMessageLink } from "@/lib/customer/notification-types";
import type { CustomerAppointmentSummary } from "@/lib/account/types";

type CustomerPreorderTracking = {
  id: string;
  title: string;
  status: string;
  payment_status: string | null;
  shipping_handling: string | null;
  created_at: string;
  vehicle_slug: string | null;
  shipment: {
    tracking_number: string;
    status: string;
    estimated_arrival: string | null;
    events: Array<{
      title: string;
      description: string | null;
      location: string | null;
      event_at: string;
    }>;
  } | null;
};

type CustomerShipment = {
  id: string;
  tracking_number: string;
  reference_type: string;
  status: string;
  origin_country: string | null;
  destination: string | null;
  estimated_arrival: string | null;
  vessel_name: string | null;
  notes: string | null;
  events: Array<{
    title: string;
    description: string | null;
    location: string | null;
    event_at: string;
  }>;
};

type CustomerFreightQuote = {
  id: string;
  service_type: string;
  origin_country: string | null;
  destination: string | null;
  status: string;
  created_at: string;
  cargo_description: string | null;
  cargo_size: string | null;
  reference_code: string | null;
};

function paymentStatusLabel(status?: string) {
  if (status === "down_payment_paid") return "25% paid";
  if (status === "completed") return "Paid in full";
  if (status === "cancelled") return "Cancelled";
  return "Awaiting 25% deposit";
}

function inquiryTypeLabel(item: CustomerInquirySummary) {
  if (item.type === "preorder" && item.is_custom_request) return "Custom request";
  if (item.type === "preorder") return "Pre-order";
  if (item.type === "finance") return "Financing";
  return item.type.charAt(0).toUpperCase() + item.type.slice(1);
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <Container className="py-16 sm:py-20">
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </Container>
    }>
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const { user, profile, displayName, signOut, getAccessToken, refreshProfile } = useCustomerAuth();
  const { loading } = useRequireCustomerAuth();
  const { formatPrice } = useCurrency();
  const { load: reloadNotifications } = useCustomerNotifications();
  const [conversations, setConversations] = useState<CustomerConversation[]>([]);
  const [threadMessages, setThreadMessages] = useState<CustomerChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [inquiries, setInquiries] = useState<CustomerInquirySummary[]>([]);
  const [preorderTracking, setPreorderTracking] = useState<CustomerPreorderTracking[]>([]);
  const [shipments, setShipments] = useState<CustomerShipment[]>([]);
  const [freightQuotes, setFreightQuotes] = useState<CustomerFreightQuote[]>([]);
  const [partsOrders, setPartsOrders] = useState<PartsOrderSummary[]>([]);
  const [appointments, setAppointments] = useState<CustomerAppointmentSummary[]>([]);
  const [cartSummary, setCartSummary] = useState<CustomerCartSummary | null>(null);
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [preorderId, setPreorderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [highlightConversationId, setHighlightConversationId] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [hasUploadedAvatar, setHasUploadedAvatar] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const deepLinkFocusRef = useRef(false);

  const overviewAvatarUrl = resolveCustomerAvatarUrl({
    profileAvatarUrl: profile?.avatar_url,
    userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
  });
  const overviewHasUploadedAvatar = Boolean(profile?.avatar_url?.trim());

  useEffect(() => {
    setAvatarPreviewUrl(overviewAvatarUrl);
    setHasUploadedAvatar(overviewHasUploadedAvatar);
  }, [overviewAvatarUrl, overviewHasUploadedAvatar]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null;

  const loadConversations = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch("/api/customer/messages", { headers });
    if (res.ok) {
      const json = await res.json();
      setConversations(json.conversations ?? []);
    }
    setDataLoading(false);
  }, [getAccessToken]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      const token = await getAccessToken();
      if (!token) return;

      setThreadLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(
        `/api/customer/messages?conversationId=${encodeURIComponent(conversationId)}`,
        { headers }
      );
      if (res.ok) {
        const json = await res.json();
        setThreadMessages(json.messages ?? []);
      }
      setThreadLoading(false);
    },
    [getAccessToken]
  );

  const loadData = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const [inquiriesRes, trackingRes, partsOrdersRes, cartRes, appointmentsRes] = await Promise.all([
      fetch("/api/customer/inquiries", { headers }),
      fetch("/api/customer/tracking", { headers }),
      fetch("/api/customer/parts-orders", { headers }),
      fetch("/api/customer/cart", { headers }),
      fetch("/api/customer/appointments", { headers }),
    ]);

    if (inquiriesRes.ok) {
      const json = await inquiriesRes.json();
      setInquiries(json.inquiries ?? []);
    }

    if (trackingRes.ok) {
      const json = await trackingRes.json();
      setPreorderTracking(json.preorders ?? []);
      setShipments(json.shipments ?? []);
      setFreightQuotes(json.quotes ?? []);
    }

    if (partsOrdersRes.ok) {
      const json = await partsOrdersRes.json();
      setPartsOrders(json.orders ?? []);
    }

    if (cartRes.ok) {
      const json = await cartRes.json();
      setCartSummary({
        item_count: json.item_count ?? 0,
        part_count: json.part_count ?? 0,
        vehicle_count: json.vehicle_count ?? 0,
        updated_at: json.updated_at ?? null,
        items: json.items ?? [],
      });
    } else {
      setCartSummary({
        item_count: 0,
        part_count: 0,
        vehicle_count: 0,
        updated_at: null,
        items: [],
      });
    }

    if (appointmentsRes.ok) {
      const json = await appointmentsRes.json();
      setAppointments(json.appointments ?? []);
    } else {
      setAppointments([]);
    }

    await loadConversations();
  }, [getAccessToken, loadConversations]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  const conversationParam = searchParams.get("conversation");
  useMarkCustomerNotificationsOnVisit({
    link: conversationParam ? accountMessageLink(conversationParam) : undefined,
  });

  useEffect(() => {
    if (!user) return;
    void reloadNotifications();
  }, [user, reloadNotifications]);

  useEffect(() => {
    const conv = searchParams.get("conversation");
    if (conv) {
      setSelectedConversationId(conv);
      setShowNewConversation(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get("conversation") && !selectedConversationId && conversations.length > 0 && !showNewConversation) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId, showNewConversation, searchParams]);

  useEffect(() => {
    if (selectedConversationId) {
      void loadThread(selectedConversationId);
    } else {
      setThreadMessages([]);
    }
  }, [selectedConversationId, loadThread]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  const appendMessage = useCallback((message: CustomerChatMessage) => {
    setThreadMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) {
        return prev.map((m) => (m.id === message.id ? message : m));
      }
      return [...prev, message];
    });
  }, []);

  useCustomerChatRealtime({
    conversationId: selectedConversationId,
    userId: user?.id ?? null,
    viewer: "customer",
    onNewMessage: appendMessage,
    onInboxUpdate: loadConversations,
    enabled: Boolean(user),
  });

  async function sendMessage(payload: {
    body: string;
    conversationId?: string;
    subject?: string;
    category?: string;
    preorderId?: string | null;
  }) {
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);

    const token = await getAccessToken();
    if (!token) {
      setFormError("Your session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/customer/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      setFormError(json.message ?? "Could not send message.");
      setSubmitting(false);
      return;
    }

    if (json.message) appendMessage(json.message as CustomerChatMessage);
    const nextId = json.conversationId as string;
    setSelectedConversationId(nextId);
    setShowNewConversation(false);
    setSubject("");
    setBody("");
    setReplyDraft("");
    setCategory("general");
    setPreorderId(null);
    setFormSuccess(
      payload.conversationId
        ? json.reopened
          ? "Ticket reopened. Our team will pick it up from the queue."
          : "Reply sent."
        : "Message sent. Our team will respond soon."
    );
    await loadConversations();
    if (!json.message) await loadThread(nextId);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage({ body, subject, category, preorderId });
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConversationId || !replyDraft.trim()) return;
    await sendMessage({ body: replyDraft, conversationId: selectedConversationId });
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  async function handleReopenTicket() {
    if (!selectedConversationId) return;
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);

    const token = await getAccessToken();
    if (!token) {
      setFormError("Your session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/customer/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "reopen", conversationId: selectedConversationId }),
    });

    const json = await res.json();
    if (!res.ok) {
      setFormError(json.message ?? "Could not reopen ticket.");
      setSubmitting(false);
      return;
    }

    setFormSuccess("Ticket reopened. Another team member will assist you.");
    await loadConversations();
    setSubmitting(false);
  }

  function startPreorderMessage(item: CustomerInquirySummary) {
    setCategory("pre-order");
    setPreorderId(item.id);
    setSubject(`Pre-order follow-up: ${item.title}`);
    setBody("");
    setFormError("");
    setFormSuccess("");
    setShowNewConversation(true);
    setSelectedConversationId(null);
    setThreadMessages([]);
  }

  const preorders = inquiries.filter((item) => item.type === "preorder");
  const customRequests = preorders.filter((item) => item.is_custom_request === true);
  const catalogPreorders = preorders.filter((item) => item.is_custom_request !== true);
  const preorderById = new Map(preorderTracking.map((p) => [p.id, p]));
  const otherInquiries = inquiries.filter((item) => item.type !== "preorder");
  const pendingOrderCount = partsOrders.filter((order) => order.status === "pending").length;
  const cartItemCount = cartSummary?.item_count ?? 0;

  const overviewInitials = (displayName || user?.email || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "C";
  const memberSinceLabel = formatMemberSince(profile?.created_at);
  const authProviderLabel = customerAuthProviderLabel(user);
  const locationLabel = [profile?.city, profile?.country].filter(Boolean).join(", ");

  const appointmentContext = buildAccountAppointmentContext({
    displayName,
    email: user?.email ?? "",
    phone: profile?.phone ?? "",
    registrationId: profile?.registration_id,
    partsOrders,
    cartSummary,
    preorders,
  });

  useEffect(() => {
    if (dataLoading) return;

    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const conversationId = searchParams.get("conversation");
    const section = searchParams.get("section");

    let targetId: string | null = null;
    if (hash === "messages" || conversationId) {
      targetId = "messages";
      deepLinkFocusRef.current = true;
    } else if (section === "orders") {
      targetId = "my-orders";
    } else if (section === "cart") {
      targetId = "my-cart";
    } else if (section === "visit" || section === "appointments") {
      targetId = "book-visit";
    } else if (section === "vehicle-requests") {
      targetId = "vehicle-requests";
    } else if (section === "preorders") {
      targetId = "my-preorders";
    } else if (hash === "vehicle-requests") {
      targetId = "vehicle-requests";
    }

    if (targetId) {
      requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (conversationId) {
      setHighlightConversationId(conversationId);
      const timer = window.setTimeout(() => setHighlightConversationId(null), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams, dataLoading]);

  const highlightedRequestId = searchParams.get("request");

  useEffect(() => {
    if (!deepLinkFocusRef.current || !selectedConversationId || threadLoading) return;
    const conversationId = searchParams.get("conversation");
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash !== "messages" && !conversationId) return;
    if (conversationId && conversationId !== selectedConversationId) return;

    deepLinkFocusRef.current = false;
    requestAnimationFrame(() => {
      replyInputRef.current?.focus({ preventScroll: true });
    });
  }, [selectedConversationId, threadLoading, searchParams]);

  if (loading || !user) {
    return (
      <Container className="py-16 sm:py-20">
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </Container>
    );
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
            <ProfileAvatarViewer
              avatarUrl={avatarPreviewUrl}
              hasUploadedAvatar={hasUploadedAvatar}
              initials={overviewInitials}
              size="md"
              getAccessToken={getAccessToken}
              onAvatarChange={async (next) => {
                setAvatarPreviewUrl(next.avatarUrl);
                setHasUploadedAvatar(next.hasUploadedAvatar);
                await refreshProfile();
              }}
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold sm:text-3xl">My Account</h1>
              <p className="mt-2 text-muted-foreground">
                Welcome back, <span className="font-medium text-foreground">{displayName}</span>
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {authProviderLabel}
                {memberSinceLabel ? ` · Member since ${memberSinceLabel}` : null}
                {locationLabel ? ` · ${locationLabel}` : null}
                {profile?.phone ? ` · ${profile.phone}` : null}
              </p>
              {profile?.registration_id && (
                <div className="mt-4 inline-flex flex-col gap-1 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your registration ID
                  </p>
                  <p className="font-mono text-lg font-semibold text-brand-purple">
                    {profile.registration_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use this ID when contacting us. Your account is private — only you can see your data.
                  </p>
                </div>
              )}
              <Link
                href="/account/settings"
                className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-brand-purple hover:underline"
              >
                Edit profile details →
              </Link>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setLogoutConfirmOpen(true)}
            className="min-h-11"
          >
            Sign out
          </Button>
        </div>

        {welcome && profile?.registration_id && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Welcome! Your registration ID is{" "}
            <span className="font-mono font-semibold">{profile.registration_id}</span>.
            Save it for reference when contacting our team.
          </p>
        )}

        <AccountNotificationsSection />

        <AccountDashboardTiles
          tiles={[
            {
              id: "cart",
              label: "My Cart",
              icon: ShoppingCart,
              href: "#my-cart",
              badge: cartItemCount,
              badgeLabel: "items in cart",
            },
            {
              id: "orders",
              label: "My Orders",
              icon: Package,
              href: "#my-orders",
              badge: pendingOrderCount,
              badgeLabel: "pending orders",
            },
            {
              id: "visit",
              label: "Book a Visit",
              icon: CalendarCheck,
              href: "#book-visit",
            },
            {
              id: "vehicle-requests",
              label: "Vehicle requests",
              icon: Search,
              href: "#vehicle-requests",
              badge: customRequests.length,
              badgeLabel: "vehicle requests",
            },
            {
              id: "preorders",
              label: "My Pre-orders",
              icon: Car,
              href: "#my-preorders",
              badge: catalogPreorders.length,
              badgeLabel: "pre-orders",
            },
          ]}
        />

        {!dataLoading && partsOrders.length > 0 && <RecentOrderBanner orders={partsOrders} />}

        <BookVisitSection
          context={appointmentContext}
          appointments={appointments}
          loading={dataLoading}
          onBooked={() => void loadData()}
        />

        <OrderHistorySection
          orders={partsOrders}
          loading={dataLoading}
        />

        <AccountCartSection cartSummary={cartSummary} loading={dataLoading} />

        <section id="shipment-tracking" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4">
          <AccountSectionHeader
            icon={<Truck className="size-5" />}
            title="Shipment Tracking"
            description="Live freight and import status for shipments linked to your account."
          />
          {dataLoading ? (
            <p className="text-sm text-muted-foreground">Loading shipments…</p>
          ) : shipments.length === 0 ? (
            <AccountEmptyState
              icon={<Truck className="size-7" />}
              title="No shipments linked yet"
              description="When your vehicle or freight is booked for shipping, tracking will appear here."
              actionLabel="Track by number"
              actionHref={ROUTES.corporate.freightTracking}
            />
          ) : (
            <ul className="space-y-4">
              {shipments.map((shipment) => (
                <li key={shipment.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold">{shipment.tracking_number}</p>
                      <p className="mt-1 text-xs text-muted-foreground capitalize">
                        {shipment.reference_type.replace(/_/g, " ")}
                        {shipment.origin_country
                          ? ` · ${shipment.origin_country} → ${shipment.destination ?? "Ghana"}`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple">
                      {shipmentStatusLabel(shipment.status)}
                    </span>
                  </div>
                  <VisualShipmentTimeline
                    status={shipment.status}
                    trackingId={shipment.tracking_number}
                    expectedArrival={shipment.estimated_arrival}
                    size="mini"
                    className="mt-4"
                  />
                  {shipment.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">{shipment.notes}</p>
                  )}
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-brand-purple hover:underline"
                    onClick={() =>
                      setExpandedShipmentId((id) => (id === shipment.id ? null : shipment.id))
                    }
                  >
                    {expandedShipmentId === shipment.id ? "Hide timeline" : "View timeline"}
                  </button>
                  {expandedShipmentId === shipment.id && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      {shipment.reference_type === "preorder" ? (
                        <ImportMilestoneTimeline
                          events={shipment.events}
                          shipmentStatus={shipment.status}
                        />
                      ) : (
                        <ShipmentTimeline events={shipment.events} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <AccountSectionHeader
            icon={<Ship className="size-5" />}
            title="Freight & Clearing"
            description="Freight quote requests submitted from your account."
          />
          {dataLoading ? (
            <p className="text-sm text-muted-foreground">Loading freight activity…</p>
          ) : freightQuotes.length === 0 ? (
            <AccountEmptyState
              icon={<Ship className="size-7" />}
              title="No freight quotes yet"
              description="Request a freight quote for vehicle import or cargo clearing."
              actionLabel="Request a quote"
              actionHref={ROUTES.corporate.freight}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {freightQuotes.map((quote) => (
                <li key={quote.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium capitalize">{quote.service_type.replace(/_/g, " ")}</p>
                    {quote.reference_code && (
                      <p className="font-mono text-xs text-muted-foreground">
                        Ref: {quote.reference_code}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {quote.origin_country ?? "—"} → {quote.destination ?? "Ghana"} ·{" "}
                      {quote.created_at.slice(0, 10)}
                    </p>
                    {formatCargoDisplay(quote.cargo_description, quote.cargo_size) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCargoDisplay(quote.cargo_description, quote.cargo_size)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {quote.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <VehicleRequestsSection
          requests={customRequests}
          conversations={conversations}
          loading={dataLoading}
          highlightedRequestId={highlightedRequestId}
        />

        <section id="my-preorders" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4">
          <AccountSectionHeader
            icon={<Car className="size-5" />}
            title="My Pre-orders"
            description="Catalog vehicle pre-orders. Each requires its own 25% down payment."
          />
          {dataLoading ? (
            <p className="text-sm text-muted-foreground">Loading pre-orders…</p>
          ) : catalogPreorders.length === 0 ? (
            <AccountEmptyState
              icon={<Car className="size-7" />}
              title="No catalog pre-orders yet"
              description="Pre-order a vehicle from our inventory, or submit a custom request if you can't find what you need."
              actionLabel="Browse inventory"
              actionHref={ROUTES.auto.inventory}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {catalogPreorders.map((item) => {
                const tracked = preorderById.get(item.id);
                const shipment = tracked?.shipment;
                return (
                  <li key={`preorder-${item.id}`} className="flex flex-col gap-3 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {item.created_at.slice(0, 10)}
                          {item.down_payment_usd != null && (
                            <> · 25% deposit: {formatPrice(item.down_payment_usd)}</>
                          )}
                        </p>
                        {item.vehicle_slug && (
                          <Link
                            href={ROUTES.auto.inventoryDetail(item.vehicle_slug)}
                            className="mt-1 inline-block text-xs font-medium text-brand-purple hover:underline"
                          >
                            View vehicle
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {paymentStatusLabel(item.payment_status)}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          Order: {tracked?.status ?? item.status}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => startPreorderMessage(item)}
                        >
                          <MessageSquare className="size-3.5" />
                          Message about this order
                        </Button>
                      </div>
                    </div>
                    {shipment ? (
                      <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 p-4">
                        <VisualShipmentTimeline
                          status={shipment.status}
                          trackingId={shipment.tracking_number}
                          expectedArrival={shipment.estimated_arrival}
                          size="mini"
                          className="mb-3 border-brand-purple/20 bg-white/50"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Ship className="size-4 text-brand-purple" />
                          <span className="font-mono font-medium">{shipment.tracking_number}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{shipmentStatusLabel(shipment.status)}</span>
                          {shipment.estimated_arrival && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground">
                                Est. {new Date(shipment.estimated_arrival).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                        {shipment.events.length > 0 && (
                          <ShipmentTimeline events={shipment.events.slice(0, 3)} className="mt-3" />
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        <Package className="mr-1 inline size-3.5" />
                        Import tracking will appear here once your vehicle is booked for shipping.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <AccountSectionHeader
            icon={<MessageSquare className="size-5" />}
            title="Other Activity"
            description="Vehicle inquiries, financing applications, and contact submissions."
          />
          {dataLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : otherInquiries.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No other inquiries yet.{" "}
              <Link href="/contact" className="font-medium text-brand-purple hover:underline">
                Contact us
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {otherInquiries.map((item) => (
                <li key={`${item.type}-${item.id}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {inquiryTypeLabel(item)} · {item.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          id="messages"
          className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <AccountSectionHeader
              icon={<MessageSquarePlus className="size-5" />}
              title="Messages"
              description="Chat with our admin, processing, or financing team."
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setShowNewConversation(true);
                setSelectedConversationId(null);
                setThreadMessages([]);
                setPreorderId(null);
              }}
            >
              <MessageSquarePlus className="size-4" />
              New message
            </Button>
          </div>

          <div className="grid gap-4 overflow-hidden rounded-lg border md:grid-cols-[minmax(0,12rem)_1fr] lg:grid-cols-[minmax(0,14rem)_1fr]">
            <div className="border-b md:border-b-0 md:border-r">
              {dataLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                <ul className="max-h-80 divide-y overflow-y-auto md:max-h-[28rem]">
                  {conversations.map((conv) => (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewConversation(false);
                          setSelectedConversationId(conv.id);
                        }}
                        className={cn(
                          "w-full px-3 py-3 text-left text-sm transition-colors hover:bg-muted/50",
                          selectedConversationId === conv.id &&
                            !showNewConversation &&
                            "bg-brand-purple/5",
                          highlightConversationId === conv.id &&
                            "ring-2 ring-brand-purple ring-inset"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 font-medium">{conv.subject}</p>
                          {conv.unreadCount > 0 && (
                            <span className="shrink-0 rounded-full bg-brand-purple px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {conv.lastMessage.body}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex min-h-[20rem] flex-col">
              {showNewConversation ? (
                <form onSubmit={handleSubmit} className="space-y-4 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-category">Category</Label>
                    <select
                      id="msg-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {CUSTOMER_MESSAGE_CATEGORIES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-subject">Subject</Label>
                    <Input
                      id="msg-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-body">Message</Label>
                    <Textarea
                      id="msg-body"
                      rows={4}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      required
                    />
                  </div>
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                  {formSuccess && <p className="text-sm text-green-700">{formSuccess}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Sending…" : "Send message"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewConversation(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : !selectedConversation ? (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Select a conversation or start a new message.
                </div>
              ) : (
                <>
                  <div className="border-b px-4 py-3">
                    <p className="font-medium">{selectedConversation.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.category} · {selectedConversation.status}
                      {selectedConversation.preorder_title && (
                        <> · {selectedConversation.preorder_title}</>
                      )}
                    </p>
                    {selectedConversation.assigned_to && selectedConversation.status !== "closed" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Handled by {selectedConversation.assigned_to.name}
                      </p>
                    )}
                    {selectedConversation.status === "closed" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          This ticket is closed.
                          {selectedConversation.resolution_note && (
                            <> {selectedConversation.resolution_note}</>
                          )}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={submitting}
                          onClick={() => void handleReopenTicket()}
                        >
                          Reopen ticket
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {threadLoading ? (
                      <p className="text-sm text-muted-foreground">Loading messages…</p>
                    ) : (
                      threadMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            msg.isMine
                              ? "ml-auto bg-brand-purple/10"
                              : "mr-auto bg-muted/60"
                          )}
                        >
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {msg.isMine ? "You" : "Nabus Motors"}{" · "}
                            {new Date(msg.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      ))
                    )}
                    <div ref={threadEndRef} />
                  </div>
                  <form
                    onSubmit={handleReply}
                    className="flex items-end gap-2 border-t p-4"
                  >
                    <Textarea
                      ref={replyInputRef}
                      rows={2}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={
                        selectedConversation.status === "closed"
                          ? "Send a message to reopen this ticket…"
                          : "Type your reply…"
                      }
                      className="min-h-[2.5rem] flex-1 resize-none"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={submitting || !replyDraft.trim()}
                      aria-label="Send reply"
                    >
                      <Send className="size-4" />
                    </Button>
                  </form>
                  {formError && <p className="px-4 pb-3 text-sm text-red-600">{formError}</p>}
                  {formSuccess && (
                    <p className="px-4 pb-3 text-sm text-green-700">{formSuccess}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Profile &amp; settings</h2>
              <p className="text-sm text-muted-foreground">
                Update your name and phone, or manage privacy and account deletion.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11 gap-2" render={<Link href="/account/settings" />}>
                <Settings className="size-4" />
                Edit profile
              </Button>
              <Button
                variant="outline"
                className="min-h-11 gap-2"
                render={<Link href="/account/settings/privacy" />}
              >
                Privacy &amp; Security
              </Button>
            </div>
          </div>
        </section>
      </div>
      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onConfirm={handleSignOut}
        confirmLabel="Sign out"
      />
    </Container>
  );
}
