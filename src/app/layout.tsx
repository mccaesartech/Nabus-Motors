import { Inter } from "next/font/google";
import { SiteChrome } from "@/components/layout/site-chrome";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: {
    default: "True Goshen Auto | Your Safe Place for Quality Vehicles",
    template: "%s | True Goshen Auto",
  },
  description:
    "Browse verified vehicles with transparent pricing, flexible financing, and trusted customer support. True Goshen Auto — Drive With Confidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
