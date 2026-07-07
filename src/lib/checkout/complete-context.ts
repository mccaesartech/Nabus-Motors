import type { CustomerInquirySummary } from "@/lib/customer/types";
import type { PartsOrderSummary } from "@/lib/parts/cart-types";

export type CheckoutCompleteVehicle = {
  id: string;
  name: string;
};

export type CheckoutCompleteContext = {
  source: "checkout" | "preorder";
  orderId?: string;
  inquiryId?: string;
  registrationId?: string;
  name: string;
  email: string;
  phone: string;
  vehicles: CheckoutCompleteVehicle[];
  message?: string;
  /** Cart order snapshot for immediate PDF/print on the success page. */
  order?: PartsOrderSummary;
  /** Pre-order snapshot for immediate PDF/print on the success page. */
  preorder?: CustomerInquirySummary;
};

export const CHECKOUT_COMPLETE_STORAGE_KEY = "tg_checkout_complete";

export function saveCheckoutCompleteContext(context: CheckoutCompleteContext): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CHECKOUT_COMPLETE_STORAGE_KEY, JSON.stringify(context));
}

export function readCheckoutCompleteContext(): CheckoutCompleteContext | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CHECKOUT_COMPLETE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutCompleteContext;
  } catch {
    return null;
  }
}

export function clearCheckoutCompleteContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CHECKOUT_COMPLETE_STORAGE_KEY);
}
