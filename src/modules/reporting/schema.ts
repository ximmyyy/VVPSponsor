import { z } from "zod";

const money = z.coerce.number();
const date = z.string();
export const dashboardSchema = z.object({
  season: z.number().int(),
  current_season: z.number().int(),
  season_start: date,
  season_end: date,
  today: date,
  kpis: z.object({
    active_paying: money,
    budget_paying: money,
    contract_value: money,
    invoiced: money,
    received: money,
    open_now: money,
    overdue_now: money,
    expiring_90: money,
    expiring_value_90: money,
    notice_60: money,
    prospects: money,
  }),
  seasons: z.array(
    z.object({
      season: z.number().int(),
      contract_value: money,
      invoiced: money,
      received: money,
    }),
  ),
  monthly: z.array(
    z.object({
      month: date,
      invoiced: money,
      received: money,
      invoiced_cumulative: money,
      received_cumulative: money,
    }),
  ),
  sponsors: z.array(
    z.object({
      sponsor_id: z.uuid(),
      name: z.string(),
      status: z.string(),
      is_paying: z.boolean(),
      archived: z.boolean(),
      contract_value: money,
      invoiced: money,
      received: money,
      open_now: money,
    }),
  ),
  expiring: z.array(
    z.object({
      contract_id: z.uuid(),
      contract_number: z.string(),
      title: z.string(),
      sponsor_id: z.uuid(),
      sponsor: z.string(),
      ends_on: date,
      notice_deadline: date.nullable(),
      value: money,
      has_successor: z.boolean(),
    }),
  ),
  prospects: z.array(
    z.object({
      sponsor_id: z.uuid(),
      name: z.string(),
      city: z.string().nullable(),
      updated_at: z.string(),
    }),
  ),
});
export const detailSchema = dashboardSchema.extend({
  contracts: z.array(
    z.object({
      contract_number: z.string(),
      sponsor: z.string(),
      title: z.string(),
      status: z.string(),
      starts_on: date,
      ends_on: date,
      notice_deadline: date.nullable(),
      terminated_on: date.nullable(),
      total_value: money,
      season_value: money,
    }),
  ),
  invoices: z.array(
    z.object({
      invoice_number: z.string(),
      kind: z.string(),
      sponsor: z.string(),
      issue_date: date,
      due_on: date,
      total: money,
      vat_total: money,
      total_excl_vat: money,
      paid: money,
      credited: money,
      open_amount: money,
    }),
  ),
  payments: z.array(
    z.object({
      received_on: date,
      sponsor: z.string(),
      direction: z.string(),
      method: z.string(),
      reference: z.string().nullable(),
      amount: money,
      allocated: money,
      unallocated: money,
    }),
  ),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Detail = z.infer<typeof detailSchema>;

/** Seizoen 2026 = 1 juli 2026 t/m 30 juni 2027. */
export const seasonLabel = (season: number) =>
  `${season}/${String(season + 1).slice(2)}`;
export function parseSeason(value: unknown, fallback: number) {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

/** Excel interpreteert tekst die met =, +, -, @ begint niet als formule wanneer de
 * cel als tekst wordt geschreven; deze extra apostrof beschermt ook bij kopiëren naar CSV. */
export function safeText(value: string | null | undefined) {
  const text = value ?? "";
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
