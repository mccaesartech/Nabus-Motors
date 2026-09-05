import { FoldHomePage } from "@/components/fold/fold-home-page";

export const metadata = {
  title: "Nabus Motors",
  description:
    "The Dzorwulu showroom. Verified cars, financing, and ownership support in Accra, Ghana.",
};

export const revalidate = 60;

export default function RootPage() {
  return <FoldHomePage />;
}
