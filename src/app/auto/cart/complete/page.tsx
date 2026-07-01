import { CheckoutCompleteClient } from "./checkout-complete-client";

export const metadata = {
  title: "Order complete",
  description: "Book a showroom visit to view and pay for your vehicle.",
};

export default function CheckoutCompletePage() {
  return <CheckoutCompleteClient />;
}
