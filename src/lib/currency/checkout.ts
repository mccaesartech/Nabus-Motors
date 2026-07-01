import { formatUsdPrice } from "./format";
import { DEFAULT_DISPLAY_CURRENCY } from "./types";

/** Cart, checkout, and pre-order deposits — always show GHS for Ghana site visitors. */
export function formatCheckoutPrice(usdAmount: number): string {
  return formatUsdPrice(usdAmount, DEFAULT_DISPLAY_CURRENCY);
}
