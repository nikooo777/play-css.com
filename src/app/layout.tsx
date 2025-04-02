import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Play CSS - Counter-Strike: Source Server Browser",
  description: "Browse and find Counter-Strike: Source (CSS) servers worldwide. Real-time server information, player counts, maps, and locations. Find the perfect CS:Source server to play on. Also compatible with CS:GO and TF2 server browsing.",
  keywords: "Counter-Strike: Source, CSS, CS:Source, server browser, game servers, CS:Source servers, multiplayer gaming, CS:Source maps, CS:Source locations, CS:Source player count, CS:Source server finder, Counter-Strike, CS:GO, TF2",
  authors: [{ name: "Play CSS" }],
  openGraph: {
    title: "Play CSS - Counter-Strike: Source Server Browser",
    description: "Browse and find Counter-Strike: Source (CSS) servers worldwide. Real-time server information, player counts, maps, and locations.",
    type: "website",
    locale: "en_US",
    siteName: "Play CSS",
  },
  twitter: {
    card: "summary_large_image",
    title: "Play CSS - Counter-Strike: Source Server Browser",
    description: "Browse and find Counter-Strike: Source (CSS) servers worldwide. Real-time server information, player counts, maps, and locations.",
  },
  robots: "index, follow",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
