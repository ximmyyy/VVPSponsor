import { z } from "zod";

const text = (max: number) =>
  z.string().trim().max(max, `Maximaal ${max} tekens.`);
/** Velden die een sponsor via een verzoek mag laten wijzigen (D043). */
export const profileFields = [
  ["name", "Bedrijfsnaam"],
  ["trading_name", "Handelsnaam"],
  ["website", "Website"],
  ["city", "Plaats"],
  ["kvk", "KvK-nummer"],
  ["vat_number", "BTW-nummer"],
  ["street", "Straat en huisnummer"],
  ["postal_code", "Postcode"],
  ["email", "Zakelijk e-mailadres"],
  ["phone", "Telefoon"],
] as const;
export type ProfileField = (typeof profileFields)[number][0];
export const fieldLabel = Object.fromEntries(profileFields) as Record<
  string,
  string
>;

export const profileRequestSchema = z.object({
  name: text(160).min(1, "Bedrijfsnaam is verplicht."),
  trading_name: text(160),
  website: z.union([
    z
      .string()
      .trim()
      .max(500)
      .regex(
        /^https?:\/\/\S+$/,
        "Gebruik een website die begint met http:// of https://.",
      ),
    z.literal(""),
  ]),
  city: text(120),
  kvk: z.union([
    z
      .string()
      .trim()
      .regex(/^\d{8}$/, "Een KvK-nummer heeft 8 cijfers."),
    z.literal(""),
  ]),
  vat_number: text(32),
  street: text(200),
  postal_code: text(20),
  email: z.union([
    z.email("Vul een geldig e-mailadres in.").max(254),
    z.literal(""),
  ]),
  phone: text(40),
  message: text(2000),
});
export const inviteSchema = z.object({
  email: z.email("Vul een geldig e-mailadres in.").max(254),
});

/** Ontvangers-mailto met onderwerp; adres komt uit clubinstellingen, nooit verzonnen. */
export function contactHref(
  address: string | null | undefined,
  company: string,
) {
  if (!address) return null;
  return `mailto:${address}?subject=${encodeURIComponent(`Sponsorportaal — ${company}`)}`;
}
export const requestStatus = {
  pending: "In behandeling",
  approved: "Verwerkt",
  rejected: "Afgewezen",
  withdrawn: "Ingetrokken",
} as const;
