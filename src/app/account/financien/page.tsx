import Link from "next/link";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import {
  formatDate,
  formatEuro,
  todayInAmsterdam,
} from "@/modules/contracts/schema";
import {
  directionLabels,
  kindLabels,
  methodLabels,
  paymentState,
} from "@/modules/finance/schema";

const PAGE = 25;

export default async function Finance({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const params = await searchParams;
  const view = params.view === "betalingen" ? "betalingen" : "facturen";
  const sponsor =
    typeof params.sponsor === "string" &&
    z.uuid().safeParse(params.sponsor).success
      ? params.sponsor
      : "";
  const status =
    params.status === "draft" || params.status === "issued"
      ? params.status
      : "";
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  const today = todayInAmsterdam();
  const href = (extra: Record<string, string>) =>
    `/account/financien?${new URLSearchParams({ view, sponsor, status, page: "1", ...extra })}`;

  let rows: React.ReactNode;
  let count = 0;
  if (view === "facturen") {
    let request = client
      .from("invoices")
      .select(
        "id,kind,status,invoice_number,issue_date,due_on,reference,sponsor_id,sponsors(name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id");
    if (sponsor) request = request.eq("sponsor_id", sponsor);
    if (status) request = request.eq("status", status);
    const result = await request.range((page - 1) * PAGE, page * PAGE - 1);
    if (result.error) throw new Error("Facturen konden niet geladen worden.");
    count = result.count || 0;
    const balances = result.data.length
      ? await client
          .from("invoice_balances")
          .select("*")
          .in(
            "invoice_id",
            result.data.map((i) => i.id),
          )
      : { data: [], error: null };
    if (balances.error) throw new Error("Saldi konden niet geladen worden.");
    const byId = new Map(balances.data.map((b) => [b.invoice_id, b]));
    rows = !result.data.length ? (
      <EmptyState
        title="Geen facturen"
        description="Stel een factuur op vanuit een bedrijf of contract."
      />
    ) : (
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Facturen"
      >
        <table>
          <caption className="sr-only">
            Facturen en creditnota&apos;s met totaal en openstaand bedrag
          </caption>
          <thead>
            <tr>
              <th scope="col">Nummer</th>
              <th scope="col">Bedrijf</th>
              <th scope="col">Factuurdatum</th>
              <th scope="col">Vervaldatum</th>
              <th scope="col">Totaal incl. BTW</th>
              <th scope="col">Open</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((i) => {
              const b = byId.get(i.id);
              return (
                <tr key={i.id}>
                  <td>
                    <Link
                      className="inline-flex min-h-11 flex-col justify-center font-semibold text-primary underline"
                      href={`/account/financien/facturen/${i.id}`}
                    >
                      {i.invoice_number || "Concept"}
                      <span className="text-xs font-normal text-foreground">
                        {kindLabels[i.kind as keyof typeof kindLabels]}
                        {i.reference ? ` · ${i.reference}` : ""}
                      </span>
                    </Link>
                  </td>
                  <td>{i.sponsors?.name}</td>
                  <td>{formatDate(i.issue_date)}</td>
                  <td>{formatDate(i.due_on)}</td>
                  <td>{formatEuro(b?.total)}</td>
                  <td>
                    {i.status === "issued" ? formatEuro(b?.open_amount) : "—"}
                  </td>
                  <td>
                    {b
                      ? paymentState(
                          { ...b, due_on: i.due_on, status: i.status },
                          today,
                        )
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } else {
    let request = client
      .from("payments")
      .select(
        "id,direction,received_on,amount,method,reference,status,sponsors(name)",
        { count: "exact" },
      )
      .order("received_on", { ascending: false })
      .order("id");
    if (sponsor) request = request.eq("sponsor_id", sponsor);
    const result = await request.range((page - 1) * PAGE, page * PAGE - 1);
    if (result.error) throw new Error("Betalingen konden niet geladen worden.");
    count = result.count || 0;
    const balances = result.data.length
      ? await client
          .from("payment_balances")
          .select("payment_id,unallocated")
          .in(
            "payment_id",
            result.data.map((p) => p.id),
          )
      : { data: [], error: null };
    if (balances.error) throw new Error("Saldi konden niet geladen worden.");
    const free = new Map(
      balances.data.map((b) => [b.payment_id, b.unallocated]),
    );
    rows = !result.data.length ? (
      <EmptyState
        title="Geen betalingen"
        description="Registreer ontvangen geld handmatig; er is geen bankkoppeling."
      />
    ) : (
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Betalingen"
      >
        <table>
          <caption className="sr-only">
            Betalingen met niet-toegewezen bedrag
          </caption>
          <thead>
            <tr>
              <th scope="col">Datum</th>
              <th scope="col">Bedrijf</th>
              <th scope="col">Soort</th>
              <th scope="col">Bedrag</th>
              <th scope="col">Niet toegewezen</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                    href={`/account/financien/betalingen/${p.id}`}
                  >
                    {formatDate(p.received_on)}
                  </Link>
                </td>
                <td>{p.sponsors?.name}</td>
                <td>
                  {directionLabels[p.direction as keyof typeof directionLabels]}{" "}
                  · {methodLabels[p.method as keyof typeof methodLabels]}
                  {p.reference ? ` · ${p.reference}` : ""}
                </td>
                <td>{formatEuro(p.amount)}</td>
                <td>{formatEuro(free.get(p.id))}</td>
                <td>
                  {p.status === "reversed" ? "Teruggedraaid" : "Geregistreerd"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Sponsoradministratie</p>
          <h1 className="mt-2 text-3xl font-semibold">Financiën</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Bedragen zijn inclusief BTW (standaard 21%). Contractwaarde,
            gefactureerd bedrag, credits en ontvangen geld blijven gescheiden.
            Geen bank- of boekhoudkoppeling: betalingen worden handmatig
            geregistreerd.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/account/financien/facturen/nieuw">
              Factuur opstellen
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account/financien/betalingen/nieuw">
              Betaling registreren
            </Link>
          </Button>
        </div>
      </div>
      <nav aria-label="Weergave" className="mb-5 flex gap-5 text-sm">
        {(["facturen", "betalingen"] as const).map((v) => (
          <Link
            key={v}
            aria-current={view === v ? "page" : undefined}
            className={`min-h-11 content-center underline ${view === v ? "font-semibold text-primary" : ""}`}
            href={`/account/financien?${new URLSearchParams({ view: v, sponsor })}`}
          >
            {v === "facturen" ? "Facturen en creditnota's" : "Betalingen"}
          </Link>
        ))}
      </nav>
      {view === "facturen" && (
        <Card className="mb-5 p-5">
          <form
            method="get"
            className="grid items-end gap-4 md:grid-cols-[1fr_auto]"
          >
            <input type="hidden" name="view" value="facturen" />
            {sponsor && <input type="hidden" name="sponsor" value={sponsor} />}
            <div>
              <label htmlFor="invoice-status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="invoice-status"
                name="status"
                defaultValue={status}
                className="crm-input"
              >
                <option value="">Alle</option>
                <option value="draft">Concept</option>
                <option value="issued">Uitgereikt</option>
              </select>
            </div>
            <Button>Toepassen</Button>
          </form>
        </Card>
      )}
      {sponsor && (
        <p className="mb-3 text-sm">
          Gefilterd op één bedrijf.{" "}
          <Link className="underline" href={`/account/financien?view=${view}`}>
            Filter wissen
          </Link>
        </p>
      )}
      <p className="mb-4 text-sm text-muted-foreground">{count} resultaten</p>
      <Card className="overflow-hidden">{rows}</Card>
      <nav
        aria-label="Pagina's"
        className="mt-5 flex items-center gap-6 text-sm"
      >
        {page > 1 && (
          <Link
            className="min-h-11 content-center underline"
            href={href({ page: String(page - 1) })}
          >
            Vorige
          </Link>
        )}
        <span>Pagina {page}</span>
        {count > page * PAGE && (
          <Link
            className="min-h-11 content-center underline"
            href={href({ page: String(page + 1) })}
          >
            Volgende
          </Link>
        )}
      </nav>
    </>
  );
}
