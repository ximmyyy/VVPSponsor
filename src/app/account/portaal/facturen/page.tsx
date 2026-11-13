import { requirePortal } from "@/modules/portal/access";
import { EmptyState } from "@/components/states";
import {
  formatDate,
  formatEuro,
  todayInAmsterdam,
} from "@/modules/contracts/schema";
import { kindLabels, paymentState } from "@/modules/finance/schema";

export default async function PortalInvoices() {
  const { client, sponsorId } = await requirePortal();
  const [balances, docs, payments] = await Promise.all([
    client
      .from("invoice_balances")
      .select(
        "invoice_id,invoice_number,kind,status,issue_date,due_on,total,vat_total,open_amount",
      )
      .eq("sponsor_id", sponsorId)
      .order("issue_date", { ascending: false }),
    client
      .from("invoice_documents")
      .select("invoice_id,documents(id,title)")
      .eq("sponsor_id", sponsorId),
    client
      .from("payments")
      .select("id,received_on,amount,direction,reference")
      .eq("sponsor_id", sponsorId)
      .order("received_on", { ascending: false }),
  ]);
  if (balances.error || docs.error || payments.error)
    throw new Error("Facturen konden niet geladen worden.");
  const pdf = new Map(
    docs.data
      .filter((d) => d.documents)
      .map((d) => [d.invoice_id, d.documents!]),
  );
  const today = todayInAmsterdam();
  return (
    <>
      <p className="eyebrow">Administratie</p>
      <h1 className="mt-2 text-3xl font-semibold">Facturen en betalingen</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bedragen inclusief BTW. Betalingen worden door de commissie verwerkt.
      </p>
      <section className="dash-panel mt-6" aria-labelledby="facturen">
        <h2 id="facturen">Facturen</h2>
        {balances.data.length ? (
          <div
            className="table-scroll mt-3"
            tabIndex={0}
            role="region"
            aria-label="Facturen"
          >
            <table>
              <caption className="sr-only">
                Facturen en creditnota&apos;s
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nummer</th>
                  <th scope="col">Datum</th>
                  <th scope="col">Vervaldatum</th>
                  <th scope="col" className="dash-num">
                    Bedrag
                  </th>
                  <th scope="col" className="dash-num">
                    Open
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">PDF</th>
                </tr>
              </thead>
              <tbody>
                {balances.data.map((b) => {
                  const doc = pdf.get(b.invoice_id!);
                  return (
                    <tr key={b.invoice_id}>
                      <td>
                        {b.invoice_number}
                        <span className="block text-xs text-muted-foreground">
                          {kindLabels[b.kind as keyof typeof kindLabels]}
                        </span>
                      </td>
                      <td>{formatDate(b.issue_date)}</td>
                      <td>{formatDate(b.due_on)}</td>
                      <td className="dash-num">{formatEuro(b.total)}</td>
                      <td className="dash-num">{formatEuro(b.open_amount)}</td>
                      <td>{paymentState(b, today)}</td>
                      <td>
                        {doc ? (
                          <a
                            className="inline-flex min-h-11 items-center underline"
                            href={`/account/documenten/${doc.id}`}
                          >
                            Download
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nog geen facturen"
            description="Uitgereikte facturen verschijnen hier automatisch."
          />
        )}
      </section>
      <section className="dash-panel mt-6" aria-labelledby="betalingen">
        <h2 id="betalingen">Verwerkte betalingen</h2>
        {payments.data.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {payments.data.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>
                  {formatDate(p.received_on)} ·{" "}
                  {p.direction === "out"
                    ? "Terugbetaling aan jullie"
                    : "Ontvangen betaling"}
                </span>
                <span className="dash-num">{formatEuro(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nog geen verwerkte betalingen.
          </p>
        )}
      </section>
    </>
  );
}
