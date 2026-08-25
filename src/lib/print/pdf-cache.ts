import type { AdminCustomerDetail } from "@/lib/platform/customers-admin";
import type { AdminOrderDetail } from "@/lib/platform/orders-admin";
import type { PreorderInquiryRow } from "@/lib/platform/preorder";

type PdfCacheEntry = {
  blob: Blob;
  createdAt: number;
};

const memoryCache = new Map<string, PdfCacheEntry>();
const inflight = new Map<string, Promise<Blob>>();

/** Fast string hash for in-memory PDF cache keys. */
export function hashDocumentHtml(html: string): string {
  let hash = 5381;
  for (let i = 0; i < html.length; i++) {
    hash = ((hash << 5) + hash) ^ html.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function getCachedPdfBlob(html: string): Blob | null {
  return memoryCache.get(hashDocumentHtml(html))?.blob ?? null;
}

export function isPdfGenerationInFlight(html: string): boolean {
  return inflight.has(hashDocumentHtml(html));
}

export async function getOrGeneratePdfBlob(
  html: string,
  generate: () => Promise<Blob>
): Promise<Blob> {
  const key = hashDocumentHtml(html);
  const cached = memoryCache.get(key);
  if (cached) return cached.blob;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = generate()
    .then((blob) => {
      memoryCache.set(key, { blob, createdAt: Date.now() });
      inflight.delete(key);
      return blob;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

/** Start PDF generation in the background; no-op if cached or already running. */
export function prewarmPdfBlob(html: string, generate: () => Promise<Blob>): void {
  const key = hashDocumentHtml(html);
  if (memoryCache.has(key) || inflight.has(key)) return;
  void getOrGeneratePdfBlob(html, generate);
}

type PrintDataCacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const orderPrintCache = new Map<string, PrintDataCacheEntry<AdminOrderDetail>>();
const preorderPrintCache = new Map<string, PrintDataCacheEntry<PreorderInquiryRow>>();
const customerPrintCache = new Map<string, PrintDataCacheEntry<AdminCustomerDetail>>();
const printDataInflight = new Map<string, Promise<unknown>>();

function dedupePrintFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = printDataInflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => {
    printDataInflight.delete(key);
  });
  printDataInflight.set(key, promise);
  return promise;
}

export function getCachedOrderForPrint(id: string): AdminOrderDetail | null {
  return orderPrintCache.get(id)?.data ?? null;
}

export function seedCachedOrder(order: AdminOrderDetail): void {
  orderPrintCache.set(order.id, { data: order, fetchedAt: Date.now() });
}

export function getCachedPreorderForPrint(id: string): PreorderInquiryRow | null {
  return preorderPrintCache.get(id)?.data ?? null;
}

export function seedCachedPreorder(inquiry: PreorderInquiryRow): void {
  preorderPrintCache.set(inquiry.id, { data: inquiry, fetchedAt: Date.now() });
}

export function getCachedCustomerForPrint(id: string): AdminCustomerDetail | null {
  return customerPrintCache.get(id)?.data ?? null;
}

export function seedCachedCustomer(customer: AdminCustomerDetail): void {
  customerPrintCache.set(customer.id, { data: customer, fetchedAt: Date.now() });
}

export async function fetchOrderForPrint(id: string): Promise<AdminOrderDetail> {
  const cached = getCachedOrderForPrint(id);
  if (cached) return cached;

  return dedupePrintFetch(`order:${id}`, async () => {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok || !json.order) {
      throw new Error(json.message ?? "Could not load order");
    }
    const order = json.order as AdminOrderDetail;
    seedCachedOrder(order);
    return order;
  });
}

export async function fetchPreorderForPrint(id: string): Promise<PreorderInquiryRow> {
  const cached = getCachedPreorderForPrint(id);
  if (cached) return cached;

  return dedupePrintFetch(`preorder:${id}`, async () => {
    const res = await fetch(`/api/admin/inquiries/preorder/${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok || !json.inquiry) {
      throw new Error(json.message ?? "Could not load pre-order");
    }
    const inquiry = json.inquiry as PreorderInquiryRow;
    seedCachedPreorder(inquiry);
    return inquiry;
  });
}

export async function fetchCustomerForPrint(id: string): Promise<AdminCustomerDetail> {
  const cached = getCachedCustomerForPrint(id);
  if (cached) return cached;

  return dedupePrintFetch(`customer:${id}`, async () => {
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok || !json.customer) {
      throw new Error(json.message ?? "Could not load customer");
    }
    const customer = json.customer as AdminCustomerDetail;
    seedCachedCustomer(customer);
    return customer;
  });
}

export function prewarmOrderForPrint(id: string): void {
  if (getCachedOrderForPrint(id)) return;
  void fetchOrderForPrint(id).catch(() => undefined);
}

export function prewarmPreorderForPrint(id: string): void {
  if (getCachedPreorderForPrint(id)) return;
  void fetchPreorderForPrint(id).catch(() => undefined);
}

export function prewarmCustomerForPrint(id: string): void {
  if (getCachedCustomerForPrint(id)) return;
  void fetchCustomerForPrint(id).catch(() => undefined);
}
