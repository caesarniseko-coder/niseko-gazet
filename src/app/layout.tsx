import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niseko Gazet | Local News from the Powder Capital",
  description:
    "Independent journalism from Niseko, Japan. Breaking stories, deep investigations, and community voices from the heart of Hokkaido.",
  openGraph: {
    title: "Niseko Gazet",
    description: "Independent journalism from Niseko, Japan",
    type: "website",
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
