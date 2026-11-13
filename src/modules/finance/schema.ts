import { z } from "zod";
import { decimal } from "../contracts/schema.ts";

const isoDate = z.iso.date({ error: "Gebruik een geldige datum." });
const optionalDate = z.union([isoDate, z.literal("")]);
const vatRate = z.union([
  decimal(2).refine((v) => Number(v) <= 100, "Maximaal 100%."),
  z.literal(""),
]);
/** Bedragen in hele centen; exacte tekst, nooit floats. */
export const cents = decimal(2).refine(
  (v) => Number(v) > 0,
  "Bedrag moet groter dan 0 zijn.",
);

/** Standaard: prijzen inclusief 21% BTW (besluit D033). */
export const DEFAULT_VAT_RATE = "21";

export const invoiceDraftSchema = z.object({
  reference: z.string().trim().max(200),
  due_on: optionalDate,
});

export const invoiceLineSchema = z
  .object({
    contract_line_id: z.union([z.uuid(), z.literal("")]),
    description: z.string().trim().max(500),
    quantity: z.union([
      decimal(2).refine((v) => Number(v) > 0, "Aantal moet groter dan 0 zijn."),
      z.literal(""),
    ]),
    unit_price: z.union([decimal(4, { negative: true }), z.literal("")]),
    vat_rate: vatRate,
  })
  .superRefine((v, ctx) => {
    if (!v.contract_line_id && !v.description)
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Vul een omschrijving in of kies een contractregel.",
      });
    if (!v.contract_line_id && !v.unit_price)
      ctx.addIssue({
        code: "custom",
        path: ["unit_price"],
        message: "Vul een bedrag inclusief BTW in.",
      });
  });

export const issueSchema = z
  .object({
    issue_date: isoDate,
    due_on: optionalDate,
    kind: z.enum(["invoice", "credit"]),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "invoice" && !v.due_on)
      ctx.addIssue({
        code: "custom",
        path: ["due_on"],
        message: "Vul de vervaldatum in.",
      });
    if (v.due_on && v.due_on < v.issue_date)
      ctx.addIssue({
        code: "custom",
        path: ["due_on"],
        message: "Vervaldatum ligt vóór de factuurdatum.",
      });
  });

export const paymentSchema = z.object({
  direction: z.enum(["in", "out"]),
  received_on: isoDate,
  amount: cents,
  method: z.enum(["bank", "cash", "other"]),
  reference: z.string().trim().max(200),
  allow_duplicate: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
});

export const kindLabels = { invoice: "Factuur", credit: "Creditnota" } as const;
export const invoiceStatusLabels = {
  draft: "Concept",
  issued: "Uitgereikt",
} as const;
export const methodLabels = {
  bank: "Bankoverschrijving",
  cash: "Contant",
  other: "Overig",
} as const;
export const directionLabels = {
  in: "Ontvangst",
  out: "Terugbetaling",
} as const;

/** Afgeleide betaalstatus voor weergave; bedragen komen uit `invoice_balances`. */
export function paymentState(
  b: {
    kind: string | null;
    status: string | null;
    total: number | string | null;
    open_amount: number | string | null;
    due_on: string | null;
  },
  today: string,
) {
  if (b.status === "draft") return "Concept";
  const open = Number(b.open_amount);
  if (b.kind === "credit")
    return open > 0 ? "Tegoed beschikbaar" : "Afgewikkeld";
  if (open <= 0) return "Voldaan";
  if (b.due_on && b.due_on < today) return "Vervallen";
  return open < Number(b.total) ? "Deels betaald" : "Openstaand";
}
