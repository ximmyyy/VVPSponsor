import "server-only";
import ExcelJS from "exceljs";
import { safeText, seasonLabel, type Detail } from "./schema";

const EURO = '"€" #,##0.00;[Red]-"€" #,##0.00';
const labels: Record<string, string> = {
  draft: "Concept",
  confirmed: "Bevestigd",
  terminated: "Beëindigd",
  invoice: "Factuur",
  credit: "Creditnota",
  in: "Ontvangst",
  out: "Terugbetaling",
  bank: "Bankoverschrijving",
  cash: "Contant",
  other: "Overig",
  active: "Actief",
  prospect: "Prospect",
  inactive: "Inactief",
};
const asDate = (v: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T12:00:00Z`) : null;

type Column = {
  header: string;
  key: string;
  width: number;
  money?: boolean;
  date?: boolean;
};
function sheet(
  book: ExcelJS.Workbook,
  name: string,
  columns: Column[],
  rows: Record<string, string | number | boolean | Date | null>[],
) {
  const ws = book.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    const clean = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === "string" ? safeText(v) : v,
      ]),
    );
    ws.addRow(clean);
  }
  columns.forEach((c, i) => {
    if (c.money) ws.getColumn(i + 1).numFmt = EURO;
    if (c.date) ws.getColumn(i + 1).numFmt = "dd-mm-yyyy";
  });
  if (rows.length)
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  return ws;
}

export async function buildWorkbook(d: Detail) {
  const book = new ExcelJS.Workbook();
  book.creator = "VV Pernis Sponsorportaal";
  book.created = new Date();
  const k = d.kpis;
  sheet(
    book,
    "Samenvatting",
    [
      { header: "Kerncijfer", key: "label", width: 48 },
      { header: "Waarde", key: "value", width: 18 },
      { header: "Toelichting", key: "note", width: 70 },
    ],
    [
      {
        label: `Seizoen ${seasonLabel(d.season)}`,
        value: null,
        note: `${d.season_start} t/m ${d.season_end}; peildatum ${d.today}`,
      },
      {
        label: "Actieve betalende sponsors",
        value: k.active_paying,
        note: "Gemarkeerd als betalend én relatiestatus actief",
      },
      {
        label: "Budget actieve betalende sponsors (seizoen)",
        value: k.budget_paying,
        note: "Contractwaarde naar rato van looptijd in dit seizoen, incl. BTW",
      },
      {
        label: "Totale contractwaarde (seizoen)",
        value: k.contract_value,
        note: "Alle vastgelegde contracten, naar rato, incl. BTW",
      },
      {
        label: "Gefactureerd (seizoen)",
        value: k.invoiced,
        note: "Uitgereikte facturen minus creditnota's op factuurdatum",
      },
      {
        label: "Ontvangen (seizoen)",
        value: k.received,
        note: "Geregistreerde ontvangsten minus terugbetalingen op ontvangstdatum",
      },
      {
        label: "Openstaand (peildatum)",
        value: k.open_now,
        note: "Alle uitgereikte facturen",
      },
      {
        label: "Vervallen (peildatum)",
        value: k.overdue_now,
        note: "Openstaand met vervaldatum vóór peildatum",
      },
      {
        label: "Contracten aflopend binnen 90 dagen",
        value: k.expiring_90,
        note: "Zonder verlenging",
      },
      {
        label: "Waarde aflopende contracten",
        value: k.expiring_value_90,
        note: "Totale contractwaarde",
      },
      { label: "Opzegdatum binnen 60 dagen", value: k.notice_60, note: "" },
      {
        label: "Prospects",
        value: k.prospects,
        note: "Relatiestatus prospect",
      },
    ],
  );
  const summary = book.getWorksheet("Samenvatting")!;
  for (const r of [4, 5, 6, 7, 8, 9, 11])
    summary.getCell(`B${r}`).numFmt = EURO;
  sheet(
    book,
    "Seizoenen",
    [
      { header: "Seizoen", key: "season", width: 12 },
      {
        header: "Contractwaarde",
        key: "contract_value",
        width: 18,
        money: true,
      },
      { header: "Gefactureerd", key: "invoiced", width: 18, money: true },
      { header: "Ontvangen", key: "received", width: 18, money: true },
    ],
    d.seasons.map((s) => ({ ...s, season: seasonLabel(s.season) })),
  );
  sheet(
    book,
    "Sponsors",
    [
      { header: "Bedrijf", key: "name", width: 40 },
      { header: "Relatiestatus", key: "status", width: 14 },
      { header: "Betalend", key: "is_paying", width: 10 },
      {
        header: "Contractwaarde seizoen",
        key: "contract_value",
        width: 22,
        money: true,
      },
      {
        header: "Gefactureerd seizoen",
        key: "invoiced",
        width: 20,
        money: true,
      },
      { header: "Ontvangen seizoen", key: "received", width: 18, money: true },
      { header: "Openstaand nu", key: "open_now", width: 16, money: true },
    ],
    d.sponsors.map((s) => ({
      ...s,
      status: s.archived ? "Gearchiveerd" : (labels[s.status] ?? s.status),
      is_paying: s.is_paying ? "Ja" : "Nee",
    })),
  );
  sheet(
    book,
    "Contracten",
    [
      { header: "Nummer", key: "contract_number", width: 16 },
      { header: "Bedrijf", key: "sponsor", width: 36 },
      { header: "Titel", key: "title", width: 36 },
      { header: "Status", key: "status", width: 12 },
      { header: "Begin", key: "starts_on", width: 12, date: true },
      { header: "Einde", key: "ends_on", width: 12, date: true },
      {
        header: "Opzeggen vóór",
        key: "notice_deadline",
        width: 14,
        date: true,
      },
      { header: "Beëindigd per", key: "terminated_on", width: 14, date: true },
      { header: "Totale waarde", key: "total_value", width: 16, money: true },
      {
        header: "Waarde dit seizoen",
        key: "season_value",
        width: 18,
        money: true,
      },
    ],
    d.contracts.map((c) => ({
      ...c,
      status: labels[c.status] ?? c.status,
      starts_on: asDate(c.starts_on),
      ends_on: asDate(c.ends_on),
      notice_deadline: asDate(c.notice_deadline),
      terminated_on: asDate(c.terminated_on),
    })),
  );
  sheet(
    book,
    "Facturen",
    [
      { header: "Nummer", key: "invoice_number", width: 16 },
      { header: "Soort", key: "kind", width: 12 },
      { header: "Bedrijf", key: "sponsor", width: 36 },
      { header: "Factuurdatum", key: "issue_date", width: 14, date: true },
      { header: "Vervaldatum", key: "due_on", width: 14, date: true },
      { header: "Totaal incl. BTW", key: "total", width: 16, money: true },
      { header: "BTW", key: "vat_total", width: 12, money: true },
      { header: "Excl. BTW", key: "total_excl_vat", width: 14, money: true },
      { header: "Betaald", key: "paid", width: 14, money: true },
      {
        header: "Gecrediteerd/verrekend",
        key: "credited",
        width: 20,
        money: true,
      },
      { header: "Open", key: "open_amount", width: 14, money: true },
    ],
    d.invoices.map((i) => ({
      ...i,
      kind: labels[i.kind] ?? i.kind,
      issue_date: asDate(i.issue_date),
      due_on: asDate(i.due_on),
    })),
  );
  sheet(
    book,
    "Betalingen",
    [
      { header: "Datum", key: "received_on", width: 12, date: true },
      { header: "Bedrijf", key: "sponsor", width: 36 },
      { header: "Soort", key: "direction", width: 14 },
      { header: "Methode", key: "method", width: 18 },
      { header: "Kenmerk", key: "reference", width: 30 },
      { header: "Bedrag", key: "amount", width: 14, money: true },
      { header: "Toegewezen", key: "allocated", width: 14, money: true },
      { header: "Niet toegewezen", key: "unallocated", width: 16, money: true },
    ],
    d.payments.map((p) => ({
      ...p,
      received_on: asDate(p.received_on),
      direction: labels[p.direction] ?? p.direction,
      method: labels[p.method] ?? p.method,
    })),
  );
  return Buffer.from(await book.xlsx.writeBuffer());
}
