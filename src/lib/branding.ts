import type { CSSProperties } from "react";

// Clubkleuren gemeten uit het officiële logo (aangeleverd 2026-11-12); vervangen de
// eerder opgegeven #125B9E/#E67522, die nagenoeg gelijk waren. Logo: public/brand.
export const branding = {
  name: "VV Pernis",
  product: "Sponsorportaal",
  colors: { primary: "#045EA7", accent: "#EA751D" },
  logo: "/brand/vv-pernis-logo.png",
} as const;

export const brandingStyle = {
  "--brand-primary": branding.colors.primary,
  "--brand-accent": branding.colors.accent,
} as CSSProperties;
