import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";

import "../index.css";

import Providers from "@/components/providers";
import { getInitialToken } from "@/lib/auth-server";

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

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the project's canonical
// domain (custom domain if assigned, else *.vercel.app) in every
// environment, so OG/Twitter image URLs resolve correctly even from
// preview deployments.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
      </body>
    </html>
  );
}
