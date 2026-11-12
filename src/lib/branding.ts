import type { CSSProperties } from "react";

// Clubkleuren aangeleverd door de opdrachtgever op 2026-11-12.
// Geen logo of publieke clubinformatie verzinnen; database-adapter volgt later.
export const branding = {
  name: "VV Pernis",
  product: "Sponsorportaal",
  colors: { primary: "#125B9E", accent: "#E67522" },
  logo: null,
} as const;

export const brandingStyle = {
  "--brand-primary": branding.colors.primary,
  "--brand-accent": branding.colors.accent,
} as CSSProperties;
