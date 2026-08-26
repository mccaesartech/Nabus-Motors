import { CurrencyToolsClient } from "./currency-tools-client";

export const metadata = {
  title: "Currency Converter",
  description:
    "Convert currencies with live USD mid-market rates used for True Goshen Auto prices.",
};

export default function CurrencyToolsPage() {
  return <CurrencyToolsClient />;
}