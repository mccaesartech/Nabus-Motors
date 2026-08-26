/** Client-safe helpers for order/customer profile linking (no server-only deps). */

export function customerProfileIdForOrder(
  order: Pick<{ userId: string | null; email: string }, "userId" | "email">
): string {
  return order.userId ?? `email:${order.email.trim().toLowerCase()}`;
}
