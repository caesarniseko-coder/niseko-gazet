import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niseko Gazet | Local News from the Powder Capital",
  description:
    "Independent journalism from Niseko, Japan. Breaking stories, deep investigations, and community voices from the heart of Hokkaido.",
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? "https://niseko-gazet.vercel.app"
  ),
  openGraph: {
    title: "Niseko Gazet",
    description:
      "Independent journalism from Niseko, Japan. Breaking stories and community voices from Hokkaido.",
    type: "website",
    siteName: "Niseko Gazet",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Niseko Gazet",
    description:
      "Independent journalism from Niseko, Japan. Breaking stories and community voices from Hokkaido.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-navy text-snow overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
