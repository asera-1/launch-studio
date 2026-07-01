import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://launch-studio-three.vercel.app";
const TITLE = "Launch Studio — App Store, Google Play & Product Hunt screenshot kits";
const DESC =
  "Turn raw app screenshots into store-ready App Store, Google Play and Product Hunt kits. Device frames, gradient backgrounds, film grain and multi-language export — all in your browser. Free and open source.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Launch Studio" },
  description: DESC,
  applicationName: "Launch Studio",
  keywords: [
    "app store screenshots", "google play screenshots", "product hunt gallery image",
    "app screenshot generator", "screenshot maker", "store listing assets", "app marketing",
    "device mockups", "ASO", "launch assets", "app screenshot tool",
  ],
  authors: [{ name: "Launch Studio" }],
  creator: "Launch Studio",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", url: SITE_URL, siteName: "Launch Studio", title: TITLE, description: DESC,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#0b1430",
  width: "device-width",
  initialScale: 1,
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Launch Studio",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web browser",
  description: DESC,
  url: SITE_URL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
