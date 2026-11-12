import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Download,
  FileText,
  Handshake,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { loadDashboard } from "@/modules/reporting/data";
import { parseSeason, seasonLabel } from "@/modules/reporting/schema";
import {
  MonthlyChart,
  SeasonChart,
  TopSponsorsChart,
} from "@/modules/reporting/charts";
import { formatDate, formatEuro } from "@/modules/contracts/schema";

const whole = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const monthName = new Intl.DateTimeFormat("nl-NL", {
  month: "short",
  timeZone: "UTC",
});
const statusNames: Record<string, string> = {
  active: "Actief",
  prospect: "Prospect",
  inactive: "Inactief",
};

function Tile({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="dash-tile">
      <p className="dash-tile-label">
        {icon}
        {label}
      </p>
      <p className="dash-tile-value">{value}</p>
      {note && <div className="dash-tile-note">{note}</div>}
    </div>
  );
}
function TableToggle({ children }: { children: ReactNode }) {
  return (
    <details className="dash-table-toggle">
      <summary>Toon als tabel</summary>
      <div
        className="table-scroll mt-2"
        tabIndex={0}
        role="region"
        aria-label="Tabelweergave"
      >
        {children}
      </div>
    </details>
  );
}
const daysUntil = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = parseSeason(params.seizoen, 0) || null;
  const { dashboard: d, access } = await loadDashboard(requested);
  const internal = access.role !== "clubbestuur";
  const k = d.kpis;
  const seasons = d.seasons.map((s) => ({
    ...s,
    label: seasonLabel(s.season),
  }));
  // Lopend seizoen: lijnen stoppen bij de huidige maand (geen vlakke toekomst).
  const thisMonth = `${d.today.slice(0, 7)}-01`;
  const monthly = d.monthly.map((m) => {
    const future = m.month > thisMonth;
    return {
      ...m,
      label: monthName
        .format(new Date(`${m.month}T00:00:00Z`))
        .replace(".", ""),
      invoiced_cumulative: future ? null : m.invoiced_cumulative,
      received_cumulative: future ? null : m.received_cumulative,
    };
  });
  const top = d.sponsors
    .filter((s) => s.contract_value > 0)
    .slice(0, 10)
    .map((s) => ({ name: s.name, value: s.contract_value }));
  const options = Array.from({ length: 7 }, (_, i) => d.current_season + 1 - i);
  const expiring = d.expiring.filter((e) => !e.has_successor);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">
            Sponsoring seizoen {seasonLabel(d.season)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(d.season_start)} t/m {formatDate(d.season_end)} ·
            bedragen incl. BTW · peildatum {formatDate(d.today)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="season" className="block text-sm font-medium">
                Seizoen
              </label>
              <select
                id="season"
                name="seizoen"
                defaultValue={d.season}
                className="crm-input mt-1"
              >
                {options.map((s) => (
                  <option key={s} value={s}>
                    {seasonLabel(s)}
                    {s === d.current_season ? " (huidig)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline">Tonen</Button>
          </form>
          <Button asChild>
            <a href={`/account/dashboard/export?seizoen=${d.season}`} download>
              <Download aria-hidden="true" /> Exporteer naar Excel
            </a>
          </Button>
        </div>
      </div>

      <section
        aria-label="Kerncijfers"
        className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]"
      >
        <div className="dash-hero">
          <p className="text-sm font-medium">
            Budget actieve betalende sponsors
          </p>
          <p className="dash-hero-value mt-3">
            {whole.format(k.budget_paying)}
          </p>
          <p className="mt-3 text-sm">
            {k.active_paying} actieve betalende{" "}
            {k.active_paying === 1 ? "sponsor" : "sponsors"} · contractwaarde
            naar rato van dit seizoen
          </p>
          {k.contract_value > k.budget_paying && (
            <p className="mt-1 text-sm">
              Totaal alle contracten: {whole.format(k.contract_value)}
            </p>
          )}
        </div>
        <div className="dash-grid">
          <Tile
            icon={<Users className="size-4" aria-hidden="true" />}
            label="Actieve betalende sponsors"
            value={k.active_paying}
            note="Gemarkeerd als betalend én actief"
          />
          <Tile
            icon={<FileText className="size-4" aria-hidden="true" />}
            label="Gefactureerd dit seizoen"
            value={whole.format(k.invoiced)}
            note={
              k.contract_value > 0
                ? `${Math.round((k.invoiced / k.contract_value) * 100)}% van de contractwaarde`
                : "Nog geen contractwaarde"
            }
          />
          <Tile
            icon={<Banknote className="size-4" aria-hidden="true" />}
            label="Ontvangen dit seizoen"
            value={whole.format(k.received)}
            note={
              k.invoiced > 0
                ? `${Math.round((k.received / k.invoiced) * 100)}% van het gefactureerde`
                : "Nog niets gefactureerd"
            }
          />
          <Tile
            icon={<AlertTriangle className="size-4" aria-hidden="true" />}
            label="Openstaand nu"
            value={whole.format(k.open_now)}
            note={
              k.overdue_now > 0 ? (
                <span className="dash-pill dash-pill-danger">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {whole.format(k.overdue_now)} vervallen
                </span>
              ) : (
                "Niets vervallen"
              )
            }
          />
          <Tile
            icon={<CalendarClock className="size-4" aria-hidden="true" />}
            label="Aflopend binnen 90 dagen"
            value={k.expiring_90}
            note={`${whole.format(k.expiring_value_90)} te verlengen · ${k.notice_60} opzegdatum binnen 60 dagen`}
          />
          <Tile
            icon={<Sparkles className="size-4" aria-hidden="true" />}
            label="Prospects"
            value={k.prospects}
            note="Potentiële sponsors in het CRM"
          />
        </div>
      </section>

      <section className="dash-two mt-6" aria-label="Ontwikkeling">
        <div className="dash-panel">
          <h2>Seizoenen vergeleken</h2>
          <p className="dash-sub">
            Contractwaarde ≠ gefactureerd ≠ ontvangen, laatste vijf seizoenen
          </p>
          <SeasonChart data={seasons} />
          <TableToggle>
            <table>
              <caption className="sr-only">Seizoenen vergeleken</caption>
              <thead>
                <tr>
                  <th scope="col">Seizoen</th>
                  <th scope="col" className="dash-num">
                    Contractwaarde
                  </th>
                  <th scope="col" className="dash-num">
                    Gefactureerd
                  </th>
                  <th scope="col" className="dash-num">
                    Ontvangen
                  </th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.season}>
                    <td>{s.label}</td>
                    <td className="dash-num">{formatEuro(s.contract_value)}</td>
                    <td className="dash-num">{formatEuro(s.invoiced)}</td>
                    <td className="dash-num">{formatEuro(s.received)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableToggle>
        </div>
        <div className="dash-panel">
          <h2>Verloop dit seizoen</h2>
          <p className="dash-sub">Cumulatief per maand, juli t/m juni</p>
          <MonthlyChart data={monthly} />
          <TableToggle>
            <table>
              <caption className="sr-only">Verloop per maand</caption>
              <thead>
                <tr>
                  <th scope="col">Maand</th>
                  <th scope="col" className="dash-num">
                    Gefactureerd
                  </th>
                  <th scope="col" className="dash-num">
                    Ontvangen
                  </th>
                  <th scope="col" className="dash-num">
                    Cumulatief gefactureerd
                  </th>
                  <th scope="col" className="dash-num">
                    Cumulatief ontvangen
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td>{m.label}</td>
                    <td className="dash-num">{formatEuro(m.invoiced)}</td>
                    <td className="dash-num">{formatEuro(m.received)}</td>
                    <td className="dash-num">
                      {formatEuro(m.invoiced_cumulative)}
                    </td>
                    <td className="dash-num">
                      {formatEuro(m.received_cumulative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableToggle>
        </div>
      </section>

      <section className="dash-two mt-6" aria-label="Sponsors en kansen">
        <div className="dash-panel">
          <h2>Grootste sponsors dit seizoen</h2>
          <p className="dash-sub">Contractwaarde naar rato, top 10</p>
          {top.length ? (
            <div className="mt-4">
              <TopSponsorsChart data={top} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Nog geen vastgelegde contracten in dit seizoen.
            </p>
          )}
        </div>
        <div className="dash-panel">
          <h2 className="flex items-center gap-2">
            <Handshake className="size-4" aria-hidden="true" /> Kansen
          </h2>
          <p className="dash-sub">
            Verlengkansen (contracten die binnen 180 dagen aflopen) en
            prospects. De volledige acquisitiepipeline volgt in fase 9.
          </p>
          <h3 className="mt-4 text-sm font-semibold">Binnenkort aflopend</h3>
          {expiring.length ? (
            <ul className="mt-2 divide-y divide-border text-sm">
              {expiring.slice(0, 8).map((e) => {
                const days = daysUntil(d.today, e.ends_on);
                const notice = e.notice_deadline
                  ? daysUntil(d.today, e.notice_deadline)
                  : null;
                return (
                  <li
                    key={e.contract_id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0">
                      {internal ? (
                        <Link
                          className="font-medium underline"
                          href={`/account/contracten/${e.contract_id}`}
                        >
                          {e.sponsor}
                        </Link>
                      ) : (
                        <span className="font-medium">{e.sponsor}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {e.contract_number} · eindigt {formatDate(e.ends_on)}
                        {e.notice_deadline
                          ? ` · opzeggen vóór ${formatDate(e.notice_deadline)}`
                          : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="dash-num">{whole.format(e.value)}</span>
                      <span
                        className={`dash-pill ${days <= 30 || (notice !== null && notice <= 14) ? "dash-pill-danger" : days <= 90 ? "dash-pill-warn" : ""}`}
                      >
                        <CalendarClock className="size-3" aria-hidden="true" />
                        {days} dagen
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Geen contracten die binnen 180 dagen aflopen zonder verlenging.
            </p>
          )}
          <h3 className="mt-5 text-sm font-semibold">Prospects</h3>
          {d.prospects.length ? (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {d.prospects.slice(0, 12).map((p) => (
                <li key={p.sponsor_id}>
                  {internal ? (
                    <Link
                      className="dash-pill underline"
                      href={`/account/sponsors/${p.sponsor_id}`}
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="dash-pill">{p.name}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Geen prospects in het CRM.
            </p>
          )}
        </div>
      </section>

      <section className="dash-panel mt-6" aria-labelledby="sponsortabel">
        <h2 id="sponsortabel">Alle sponsors dit seizoen</h2>
        <p className="dash-sub">
          Actieve betalende sponsors en iedereen met contractwaarde, facturen of
          openstaande bedragen.
        </p>
        {d.sponsors.length ? (
          <div
            className="table-scroll mt-4"
            tabIndex={0}
            role="region"
            aria-label="Sponsors dit seizoen"
          >
            <table>
              <caption className="sr-only">Cijfers per sponsor</caption>
              <thead>
                <tr>
                  <th scope="col">Sponsor</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="dash-num">
                    Contractwaarde
                  </th>
                  <th scope="col" className="dash-num">
                    Gefactureerd
                  </th>
                  <th scope="col" className="dash-num">
                    Ontvangen
                  </th>
                  <th scope="col" className="dash-num">
                    Openstaand
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.sponsors.map((s) => (
                  <tr key={s.sponsor_id}>
                    <td>
                      {internal ? (
                        <Link
                          className="underline"
                          href={`/account/sponsors/${s.sponsor_id}`}
                        >
                          {s.name}
                        </Link>
                      ) : (
                        s.name
                      )}
                    </td>
                    <td>
                      {s.archived
                        ? "Gearchiveerd"
                        : (statusNames[s.status] ?? s.status)}
                      {s.is_paying && " · betalend"}
                    </td>
                    <td className="dash-num">{formatEuro(s.contract_value)}</td>
                    <td className="dash-num">{formatEuro(s.invoiced)}</td>
                    <td className="dash-num">{formatEuro(s.received)}</td>
                    <td className="dash-num">{formatEuro(s.open_now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nog geen sponsors met cijfers in dit seizoen.
          </p>
        )}
      </section>
      <p className="mt-6 text-xs text-muted-foreground">
        Definities: actieve sponsor = gemarkeerd als betalend én relatiestatus
        actief. Contractwaarde wordt naar rato van de looptijd over seizoenen
        verdeeld; gefactureerd op factuurdatum (minus credits); ontvangen op
        ontvangstdatum (minus terugbetalingen). Alle bedragen inclusief BTW.
      </p>
    </>
  );
}
