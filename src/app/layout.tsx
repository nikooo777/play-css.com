import type { Metadata, Viewport } from "next";
import { Barlow, Chakra_Petch, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
});

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-share-tech",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0f12",
};

export const metadata: Metadata = {
  title: "play-css.com — Counter-Strike: Source Server Browser",
  description:
    "Browse every real Counter-Strike: Source server. Live player counts, maps and locations, with fake and spam servers filtered out.",
  authors: [{ name: "play-css.com" }],
  openGraph: {
    title: "play-css.com — Counter-Strike: Source Server Browser",
    description:
      "Browse every real Counter-Strike: Source server. Live player counts, maps and locations, with fake and spam servers filtered out.",
    type: "website",
    locale: "en_US",
    siteName: "play-css.com",
  },
  robots: "index, follow",
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
    <html
      lang="en"
      className={`${barlow.variable} ${chakraPetch.variable} ${shareTechMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
