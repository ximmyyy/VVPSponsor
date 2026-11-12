import type { Metadata } from "next";
import "./globals.css";
import { brandingStyle } from "@/lib/branding";

export const metadata: Metadata = {
  title: "VV Pernis Sponsorportaal",
  description: "Sponsorportaal in ontwikkeling.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" style={brandingStyle}>
      <body>{children}</body>
    </html>
  );
}
