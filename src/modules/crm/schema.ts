import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
const email = z.union([z.email().max(254), z.literal("")], {
  error: "Vul een geldig e-mailadres in.",
});
export const companySchema = z.object({
  name: text(160).min(1, "Vul de bedrijfsnaam in."),
  trading_name: text(160),
  website: z.union([
    z
      .url()
      .max(500)
      .refine((value) => {
        try {
          const u = new URL(value);
          return (
            ["http:", "https:"].includes(u.protocol) &&
            !u.username &&
            !u.password
          );
        } catch {
          return false;
        }
      }, "Gebruik een HTTP(S)-website zonder inloggegevens."),
    z.literal(""),
  ]),
  city: text(120),
  status: z.enum(["prospect", "active", "inactive"]),
  kvk: z.union([
    z.string().regex(/^\d{8}$/, "Gebruik 8 cijfers."),
    z.literal(""),
  ]),
  vat_number: text(32),
  street: text(200),
  postal_code: text(20),
  email,
  phone: text(40),
  notes: text(10000),
  owner_id: z.union([z.uuid(), z.literal("")]),
});
export type CompanyInput = z.infer<typeof companySchema>;
export const blankCompany: CompanyInput = {
  name: "",
  trading_name: "",
  website: "",
  city: "",
  status: "prospect",
  kvk: "",
  vat_number: "",
  street: "",
  postal_code: "",
  email: "",
  phone: "",
  notes: "",
  owner_id: "",
};
export const contactSchema = z.object({
  name: text(160).min(1, "Vul de naam in."),
  position: text(120),
  email,
  phone: text(40),
  is_primary: z.boolean(),
});
export type ContactInput = z.infer<typeof contactSchema>;
export const statusLabels = {
  prospect: "Prospect",
  active: "Actief",
  inactive: "Inactief",
};
