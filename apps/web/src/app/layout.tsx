import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";

import "../index.css";

import Providers from "@/components/providers";
import { getToken } from "@/lib/auth-server";

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

export const metadata: Metadata = {
  title: "Theologia — Study theology with the whole church in the room",
  description:
    "A framework-aware AI study environment for pastors, apologists, and serious students of biblical theology. Answers shaped by your tradition, grounded in church history, tested against the strongest opposing arguments.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialToken={token}>{children}</Providers>
      </body>
    </html>
  );
}
