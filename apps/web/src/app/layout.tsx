import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";

import "../index.css";

import Providers from "@/components/providers";
import { getInitialToken } from "@/lib/auth-server";
import { SITE_URL } from "@/lib/site-url";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Theologia — Study theology with the whole church in the room";
const description =
  "A framework-aware AI study environment for pastors, apologists, and serious students of biblical theology. Answers shaped by your tradition, grounded in church history, tested against the strongest opposing arguments.";

// maximum-scale=1 stops iOS Safari from auto-zooming the page when a
// sub-16px input is focused. Safari still honors user pinch-zoom (it
// ignores the cap for user gestures), so accessibility zoom is intact.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "Theologia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getInitialToken();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers initialToken={token}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
