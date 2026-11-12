import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, message: string) => text(max).min(1, message);
const isoDate = z.iso.date({ error: "Gebruik een geldige datum." });
const optionalDate = z.union([isoDate, z.literal("")]);
/** Exacte decimalen als tekst; nooit via floats rekenen. */
export const decimal = (scale: number, { negative = false } = {}) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .refine(
      (value) =>
        new RegExp(
          `^${negative ? "-?" : ""}\\d{1,10}(\\.\\d{1,${scale}})?$`,
        ).test(value),
      `Gebruik een getal met maximaal ${scale} decimalen.`,
    );
const optionalDecimal = (scale: number) =>
  z.union([decimal(scale), z.literal("")]);
const positiveQuantity = decimal(2).refine(
  (value) => Number(value) > 0,
  "Hoeveelheid moet groter dan 0 zijn.",
);
const vatRate = z.union([
  decimal(2).refine((v) => Number(v) <= 100, "Maximaal 100%."),
  z.literal(""),
]);
const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const packageSchema = z.object({
  name: required(160, "Vul de pakketnaam in."),
  description: text(4000),
});
export type PackageInput = z.infer<typeof packageSchema>;

export const templateSchema = z.object({
  description: required(1000, "Omschrijf het recht."),
  quantity: positiveQuantity,
  unit: required(60, "Vul een eenheid in."),
  timing: text(200),
});
export const versionSchema = z.object({
  description: text(4000),
  list_price: optionalDecimal(2),
  vat_rate: vatRate,
  rights: z.array(templateSchema).max(50, "Maximaal 50 rechten per versie."),
});
export type VersionInput = z.input<typeof versionSchema>;

const period = {
  title: required(160, "Vul een contracttitel in."),
  starts_on: isoDate,
  ends_on: isoDate,
  notice_deadline: optionalDate,
};
const periodRule = <
  T extends { starts_on: string; ends_on: string; notice_deadline: string },
>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (value.ends_on < value.starts_on)
    ctx.addIssue({
      code: "custom",
      path: ["ends_on"],
      message: "Einddatum ligt vóór de begindatum.",
    });
  if (value.notice_deadline && value.notice_deadline > value.ends_on)
    ctx.addIssue({
      code: "custom",
      path: ["notice_deadline"],
      message: "Opzegdatum ligt na de einddatum.",
    });
};
export const contractSchema = z
  .object({
    ...period,
    renewal_terms: text(2000),
    terms: text(10000),
  })
  .superRefine(periodRule);
export type ContractInput = z.infer<typeof contractSchema>;
export const blankContract: ContractInput = {
  title: "",
  starts_on: "",
  ends_on: "",
  notice_deadline: "",
  renewal_terms: "",
  terms: "",
};
export const renewalSchema = z.object(period).superRefine(periodRule);

export const lineSchema = z
  .object({
    package_version_id: z.union([z.uuid(), z.literal("")]),
    title: text(160),
    description: text(4000),
    quantity: positiveQuantity,
    unit_price: optionalDecimal(4),
    vat_rate: vatRate,
    copy_rights: checkbox,
  })
  .superRefine((value, ctx) => {
    if (!value.package_version_id && !value.title)
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Vul een titel in of kies een pakketversie.",
      });
    if (!value.package_version_id && !value.unit_price)
      ctx.addIssue({
        code: "custom",
        path: ["unit_price"],
        message: "Vul een prijs in voor maatwerk.",
      });
  });
export const amendmentLineSchema = z.object({
  title: required(160, "Vul een titel in."),
  description: text(4000),
  quantity: positiveQuantity,
  unit_price: decimal(4, { negative: true }),
  vat_rate: vatRate,
});

export const rightSchema = z.object({
  description: required(1000, "Omschrijf het recht."),
  quantity: positiveQuantity,
  unit: required(60, "Vul een eenheid in."),
  deadline: optionalDate,
  responsible_id: z.union([z.uuid(), z.literal("")]),
  portal_visible: checkbox,
  contract_line_id: z.union([z.uuid(), z.literal("")]).optional(),
});
export const rightUpdateSchema = z.object({
  deadline: optionalDate,
  responsible_id: z.union([z.uuid(), z.literal("")]),
  status: z.enum(["open", "in_progress", "fulfilled"]),
  portal_visible: checkbox,
});

export const amendmentSchema = z
  .object({
    effective_on: isoDate,
    reason: required(2000, "Leg de reden vast."),
    ends_on: optionalDate,
    notice_deadline: optionalDate,
    change_notice: checkbox,
    add_lines: z.array(amendmentLineSchema).max(20),
    add_rights: z.array(rightSchema.omit({ contract_line_id: true })).max(20),
    cancel_rights: z.array(z.uuid()).max(50),
  })
  .refine(
    (v) =>
      v.ends_on ||
      v.change_notice ||
      v.add_lines.length ||
      v.add_rights.length ||
      v.cancel_rights.length,
    {
      message: "Een amendement bevat minimaal één wijziging.",
      path: ["reason"],
    },
  );

export const terminationSchema = z.object({
  terminated_on: isoDate,
  reason: required(2000, "Leg de reden vast."),
});

export const fulfillmentSchema = z.object({
  fulfilled_on: isoDate,
  quantity: positiveQuantity,
  description: required(2000, "Omschrijf de uitvoering."),
  portal_visible: checkbox,
});

export const statusLabels = {
  draft: "Concept",
  confirmed: "Bevestigd",
  terminated: "Beëindigd",
} as const;
export const versionLabels = {
  draft: "Concept",
  published: "Gepubliceerd",
  retired: "Uitgefaseerd",
} as const;
export const rightLabels = {
  open: "Open",
  in_progress: "In uitvoering",
  fulfilled: "Uitgevoerd",
  cancelled: "Geannuleerd",
} as const;

/** Afgeleide periodeweergave; de opgeslagen status blijft leidend. */
export function contractPhase(
  contract: { status: string; starts_on: string; ends_on: string },
  today: string,
) {
  if (contract.status !== "confirmed")
    return statusLabels[contract.status as keyof typeof statusLabels];
  if (contract.ends_on < today) return "Bevestigd · looptijd verstreken";
  if (contract.starts_on > today) return "Bevestigd · nog niet gestart";
  return "Bevestigd · lopend";
}

export function todayInAmsterdam(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
  }).format(now);
}

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
/** Alleen weergave; berekeningen gebeuren in de database. */
export function formatEuro(value: string | number | null | undefined) {
  return value === null || value === undefined || value === ""
    ? "—"
    : euro.format(Number(value));
}
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}
