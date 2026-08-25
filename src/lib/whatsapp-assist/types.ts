export type WhatsAppAssistContextType =
  | "customer"
  | "preorder"
  | "order"
  | "quote"
  | "shipment"
  | "inquiry";

export type WhatsAppConversationTurn = {
  role: "staff" | "customer" | "system";
  body: string;
  at?: string | null;
  source?: string | null;
};

export type WhatsAppCustomerFacts = {
  customer: {
    name: string | null;
    email: string | null;
    phone: string;
    userId: string | null;
    registrationId: string | null;
    whatsappOptIn: boolean | null;
    accountCreatedAt: string | null;
  };
  focus: Record<string, unknown> | null;
  focusLabel: string | null;
  preorders: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  quotes: Array<Record<string, unknown>>;
  shipments: Array<Record<string, unknown>>;
  platformMessages: WhatsAppConversationTurn[];
  whatsappHistory: WhatsAppConversationTurn[];
  staffWhatsAppHistory: WhatsAppConversationTurn[];
};

export type WhatsAppSuggestResult = {
  contextSummary: string;
  followUpReason: string;
  suggestedMessage: string;
  missingFields: string[];
  needsClarification: boolean;
};

export type WhatsAppSuggestRequest = {
  phone: string;
  customerName?: string;
  customerId?: string;
  userId?: string;
  email?: string;
  contextType?: WhatsAppAssistContextType;
  contextId?: string;
  inquiryType?: string;
  mode?: "initial" | "reply";
  lastCustomerMessage?: string;
  staffInstructions?: string;
  conversationHistory?: WhatsAppConversationTurn[];
};

export type WhatsAppSendRequest = {
  phone: string;
  message: string;
  customerName?: string;
  customerId?: string;
  userId?: string;
  email?: string;
  contextType?: WhatsAppAssistContextType;
  contextId?: string;
};

export type WhatsAppSendResult = {
  ok: true;
  method: "api" | "wa_me";
  sent: boolean;
  waMeUrl?: string;
  messageId?: string;
  logId?: string | null;
  reason?: string;
};
