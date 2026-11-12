import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VV Pernis Sponsorportaal",
  description: "Sponsorportaal in ontwikkeling.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
