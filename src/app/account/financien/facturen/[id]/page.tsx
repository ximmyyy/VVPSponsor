import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { ReactNode } from "react";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Field, StateForm } from "@/modules/contracts/forms";
import {
  addInvoiceLine,
  allocate,
  createCreditNote,
  deleteInvoiceDraft,
  issueInvoice,
  removeInvoiceLine,
  reverseAllocation,
  updateInvoiceDraft,
  uploadInvoiceDocument,
} from "@/modules/finance/actions";
import {
  formatDate,
  formatEuro,
  todayInAmsterdam,
} from "@/modules/contracts/schema";
import {
  DEFAULT_VAT_RATE,
  kindLabels,
  paymentState,
} from "@/modules/finance/schema";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-md border border-border p-4">
      <summary className="min-h-11 cursor-pointer content-center font-medium">
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireCrm();
  const invoice = await client
    .from("invoices")
    .select("*,sponsors(id,name,archived_at)")
    .eq("id", id)
    .maybeSingle();
  if (invoice.error) throw new Error("Factuur kon niet geladen worden.");
  if (!invoice.data) notFound();
  const inv = invoice.data;
  const draft = inv.status === "draft";
  const isCredit = inv.kind === "credit";
  const back = `/account/financien/facturen/${id}`;
  const [
    lines,
    balance,
    payAlloc,
    creditIn,
    creditOut,
    credits,
    docs,
    related,
  ] = await Promise.all([
    client
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", id)
      .order("position")
      .order("created_at"),
    client.from("invoice_balances").select("*").eq("invoice_id", id).single(),
    client
      .from("payment_allocations")
      .select(
        "id,amount,created_at,reversed_at,payment_id,payments(received_on,reference,direction)",
      )
      .eq("invoice_id", id)
      .order("created_at"),
    client
      .from("credit_allocations")
      .select(
        "id,amount,created_at,reversed_at,credit_invoice_id,invoices!credit_allocations_credit_invoice_id_sponsor_id_fkey(invoice_number)",
      )
      .eq("target_invoice_id", id)
      .order("created_at"),
    client
      .from("credit_allocations")
      .select(
        "id,amount,created_at,reversed_at,target_invoice_id,invoices!credit_allocations_target_invoice_id_sponsor_id_fkey(invoice_number)",
      )
      .eq("credit_invoice_id", id)
      .order("created_at"),
    client
      .from("invoices")
      .select("id,invoice_number,status")
      .eq("original_invoice_id", id)
      .order("created_at"),
    client
      .from("invoice_documents")
      .select("documents(id,title,sponsor_shared,upload_status)")
      .eq("invoice_id", id),
    Promise.all([
      inv.contract_id
        ? client
            .from("contracts")
            .select("id,contract_number,title")
            .eq("id", inv.contract_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      inv.original_invoice_id
        ? client
            .from("invoices")
            .select("id,invoice_number")
            .eq("id", inv.original_invoice_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]),
  ]);
  for (const r of [
    lines,
    balance,
    payAlloc,
    creditIn,
    creditOut,
    credits,
    docs,
  ])
    if (r.error)
      throw new Error("Factuuronderdelen konden niet geladen worden.");
  const [contract, original] = related;
  const b = balance.data!;
  const today = todayInAmsterdam();
  // Keuzelijsten alleen waar nodig.
  const contractLines = draft
    ? await client
        .from("contract_lines")
        .select(
          "id,title,line_total,contract_id,contracts!inner(contract_number,status)",
        )
        .eq("sponsor_id", inv.sponsor_id)
        .neq("contracts.status", "draft")
        .order("created_at")
    : { data: [], error: null };
  const openInvoices =
    !draft && isCredit && Number(b.open_amount) > 0
      ? await client
          .from("invoice_balances")
          .select("invoice_id,invoice_number,open_amount")
          .eq("sponsor_id", inv.sponsor_id)
          .eq("kind", "invoice")
          .eq("status", "issued")
          .gt("open_amount", 0)
      : { data: [], error: null };
  if (contractLines.error || openInvoices.error)
    throw new Error("Keuzelijsten konden niet geladen worden.");
  const snapshot = (inv.billing_snapshot || {}) as Record<
    string,
    string | null
  >;
  const state = paymentState(
    { ...b, due_on: inv.due_on, status: inv.status },
    today,
  );

  return (
    <>
      <Link
        href="/account/financien"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar financiën
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {kindLabels[inv.kind as keyof typeof kindLabels]}
          </p>
          <h1 className="my-2 text-3xl font-semibold">
            {inv.invoice_number || "Concept (nog geen nummer)"}
          </h1>
          <p className="text-sm">
            <Link
              className="underline"
              href={`/account/sponsors/${inv.sponsor_id}`}
            >
              {inv.sponsors?.name}
            </Link>
            {contract.data && (
              <>
                {" · "}
                <Link
                  className="underline"
                  href={`/account/contracten/${contract.data.id}`}
                >
                  {contract.data.contract_number}
                </Link>
              </>
            )}
            {original.data && (
              <>
                {" · credit op "}
                <Link
                  className="underline"
                  href={`/account/financien/facturen/${original.data.id}`}
                >
                  {original.data.invoice_number}
                </Link>
              </>
            )}
          </p>
          <Badge role="status" className="mt-3">
            {state}
          </Badge>
        </div>
        <Card className="min-w-64 p-5 text-sm">
          <dl className="crm-definition">
            {[
              ["Totaal incl. BTW", formatEuro(b.total)],
              ["waarvan BTW", formatEuro(b.vat_total)],
              ["Totaal excl. BTW", formatEuro(b.total_excl_vat)],
              ...(isCredit
                ? [
                    ["Verrekend", formatEuro(b.credit_applied)],
                    ["Terugbetaald", formatEuro(b.paid)],
                    ["Resterend tegoed", formatEuro(b.open_amount)],
                  ]
                : [
                    ["Betaald", formatEuro(b.paid)],
                    ["Gecrediteerd", formatEuro(b.credited)],
                    ["Openstaand", formatEuro(b.open_amount)],
                  ]),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Gegevens</h2>
          <dl className="crm-definition">
            {[
              ["Kenmerk", inv.reference || "—"],
              ["Factuurdatum", formatDate(inv.issue_date)],
              ["Vervaldatum", formatDate(inv.due_on)],
              ["Prijzen", "Inclusief BTW"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Factuuradres</h2>
          {draft ? (
            <p className="text-sm text-muted-foreground">
              Bij uitreiken worden de actuele bedrijfsgegevens vastgelegd.
            </p>
          ) : (
            <dl className="crm-definition mt-4">
              {[
                ["Naam", snapshot.name],
                [
                  "Adres",
                  [snapshot.street, snapshot.postal_code, snapshot.city]
                    .filter(Boolean)
                    .join(", "),
                ],
                ["KvK-nummer", snapshot.kvk],
                ["BTW-nummer", snapshot.vat_number],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="regels">
        <h2 id="regels" className="mb-4 text-xl font-semibold">
          Factuurregels
        </h2>
        <Card className="overflow-hidden">
          {!lines.data!.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nog geen regels.
            </p>
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Factuurregels"
            >
              <table>
                <caption className="sr-only">
                  Regels met bedragen inclusief BTW
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Omschrijving</th>
                    <th scope="col">Aantal</th>
                    <th scope="col">Prijs incl. BTW</th>
                    <th scope="col">BTW</th>
                    <th scope="col">BTW-bedrag</th>
                    <th scope="col">Totaal incl. BTW</th>
                    {draft && <th scope="col">Actie</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.data!.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.description}
                        {l.contract_line_id && (
                          <span className="block text-xs text-muted-foreground">
                            Uit contractregel
                          </span>
                        )}
                      </td>
                      <td>{l.quantity}</td>
                      <td>{formatEuro(l.unit_price)}</td>
                      <td>{l.vat_rate}%</td>
                      <td>{formatEuro(l.vat_amount)}</td>
                      <td>{formatEuro(l.line_total)}</td>
                      {draft && (
                        <td>
                          <StateForm
                            action={removeInvoiceLine}
                            hidden={{ id: l.id, invoice: id }}
                            submit="Verwijderen"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {draft && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Regel uit contract">
              {contractLines.data!.length ? (
                <StateForm
                  action={addInvoiceLine}
                  hidden={{ invoice: id, description: "", vat_rate: "" }}
                  submit="Contractregel toevoegen"
                >
                  <div>
                    <label
                      htmlFor="inv-cl"
                      className="block text-sm font-medium"
                    >
                      Contractregel *
                    </label>
                    <select
                      id="inv-cl"
                      name="contract_line_id"
                      required
                      defaultValue=""
                      className="crm-input"
                    >
                      <option value="" disabled>
                        Kies een regel
                      </option>
                      {contractLines.data!.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.contracts.contract_number} · {c.title} (
                          {formatEuro(c.line_total)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-fields">
                    <Field
                      label="Aantal"
                      name="quantity"
                      inputMode="decimal"
                      hint="Leeg = aantal uit contract."
                    />
                    <Field
                      label="Prijs incl. BTW (termijn)"
                      name="unit_price"
                      inputMode="decimal"
                      hint="Leeg = volledige contractprijs."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Meer factureren dan per contractregel is afgesproken wordt
                    bij uitreiken geweigerd.
                  </p>
                </StateForm>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Dit bedrijf heeft geen vastgelegde contractregels.
                </p>
              )}
            </Panel>
            <Panel title="Losse regel">
              <StateForm
                action={addInvoiceLine}
                hidden={{ invoice: id, contract_line_id: "" }}
                submit="Losse regel toevoegen"
              >
                <Field label="Omschrijving" name="description" required />
                <div className="crm-fields">
                  <Field
                    label="Aantal"
                    name="quantity"
                    defaultValue="1"
                    inputMode="decimal"
                    required
                  />
                  <Field
                    label="Prijs incl. BTW (EUR)"
                    name="unit_price"
                    inputMode="decimal"
                    required
                  />
                  <Field
                    label="BTW-tarief (%)"
                    name="vat_rate"
                    defaultValue={DEFAULT_VAT_RATE}
                    inputMode="decimal"
                  />
                </div>
              </StateForm>
            </Panel>
          </div>
        )}
      </section>

      {draft && (
        <section
          className="mt-8 grid gap-4 lg:grid-cols-2"
          aria-label="Concepthandelingen"
        >
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Concept bewerken</h2>
            <StateForm
              action={updateInvoiceDraft}
              hidden={{ id }}
              submit="Concept opslaan"
            >
              <Field
                label="Kenmerk / omschrijving"
                name="reference"
                defaultValue={inv.reference ?? ""}
              />
              <Field
                label="Vervaldatum"
                name="due_on"
                type="date"
                defaultValue={inv.due_on ?? ""}
              />
            </StateForm>
            <div className="mt-6 border-t border-border pt-4">
              <StateForm
                action={deleteInvoiceDraft}
                hidden={{ id }}
                submit="Concept verwijderen"
                variant="destructive"
                confirm="Concept definitief verwijderen? Er is nog geen nummer toegekend."
              />
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold">
              {isCredit ? "Creditnota uitreiken" : "Factuur uitreiken"}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Kent het volgende {isCredit ? "C" : "F"}-nummer toe en legt regels
              en factuuradres vast. Daarna is wijzigen alleen mogelijk via een
              creditnota.
              {isCredit &&
                " Het creditbedrag wordt eerst verrekend met het openstaande deel van de oorspronkelijke factuur."}
            </p>
            <StateForm
              action={issueInvoice}
              hidden={{ id, kind: inv.kind }}
              submit={isCredit ? "Creditnota uitreiken" : "Factuur uitreiken"}
              variant="default"
              confirm="Definitief uitreiken? Dit kan niet ongedaan worden gemaakt."
            >
              <Field
                label="Factuurdatum"
                name="issue_date"
                type="date"
                required
                defaultValue={today}
              />
              <Field
                label={isCredit ? "Vervaldatum (optioneel)" : "Vervaldatum"}
                name="due_on"
                type="date"
                required={!isCredit}
                defaultValue={inv.due_on ?? ""}
              />
            </StateForm>
          </Card>
        </section>
      )}

      {!draft && (
        <section className="mt-8" aria-labelledby="afwikkeling">
          <h2 id="afwikkeling" className="mb-4 text-xl font-semibold">
            Afwikkeling
          </h2>
          <Card className="space-y-3 p-6 text-sm">
            {!payAlloc.data!.length &&
              !creditIn.data!.length &&
              !creditOut.data!.length && (
                <p className="text-muted-foreground">
                  Nog niets toegewezen of verrekend.
                </p>
              )}
            {payAlloc.data!.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p
                  className={
                    a.reversed_at ? "text-muted-foreground line-through" : ""
                  }
                >
                  {a.payments?.direction === "out"
                    ? "Terugbetaling"
                    : "Betaling"}{" "}
                  {formatDate(a.payments?.received_on)}
                  {a.payments?.reference
                    ? ` (${a.payments.reference})`
                    : ""}: {formatEuro(a.amount)}{" "}
                  <Link
                    className="underline"
                    href={`/account/financien/betalingen/${a.payment_id}`}
                  >
                    bekijken
                  </Link>
                </p>
                {!a.reversed_at && (
                  <StateForm
                    action={reverseAllocation}
                    hidden={{ id: a.id, kind: "payment", back }}
                    submit="Terugdraaien"
                    confirm="Toewijzing terugdraaien?"
                  />
                )}
              </div>
            ))}
            {creditIn.data!.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p
                  className={
                    a.reversed_at ? "text-muted-foreground line-through" : ""
                  }
                >
                  Verrekend met creditnota{" "}
                  <Link
                    className="underline"
                    href={`/account/financien/facturen/${a.credit_invoice_id}`}
                  >
                    {a.invoices?.invoice_number}
                  </Link>
                  : {formatEuro(a.amount)}
                </p>
                {!a.reversed_at && (
                  <StateForm
                    action={reverseAllocation}
                    hidden={{ id: a.id, kind: "credit", back }}
                    submit="Terugdraaien"
                    confirm="Verrekening terugdraaien?"
                  />
                )}
              </div>
            ))}
            {creditOut.data!.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p
                  className={
                    a.reversed_at ? "text-muted-foreground line-through" : ""
                  }
                >
                  Verrekend met factuur{" "}
                  <Link
                    className="underline"
                    href={`/account/financien/facturen/${a.target_invoice_id}`}
                  >
                    {a.invoices?.invoice_number}
                  </Link>
                  : {formatEuro(a.amount)}
                </p>
                {!a.reversed_at && (
                  <StateForm
                    action={reverseAllocation}
                    hidden={{ id: a.id, kind: "credit", back }}
                    submit="Terugdraaien"
                    confirm="Verrekening terugdraaien?"
                  />
                )}
              </div>
            ))}
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {!isCredit && Number(b.open_amount) > 0 && (
              <Card className="p-6 text-sm">
                <h3 className="mb-2 font-semibold">Betaling toewijzen</h3>
                <p className="text-muted-foreground">
                  Registreer de ontvangst en wijs haar toe vanaf de betaling.{" "}
                  <Link
                    className="underline"
                    href={`/account/financien/betalingen/nieuw?sponsor=${inv.sponsor_id}`}
                  >
                    Betaling registreren
                  </Link>
                </p>
              </Card>
            )}
            {isCredit && Number(b.open_amount) > 0 && (
              <Card className="p-6">
                <h3 className="mb-3 font-semibold">
                  Tegoed verrekenen of terugbetalen
                </h3>
                {openInvoices.data!.length ? (
                  <StateForm
                    action={allocate}
                    hidden={{ source: id, kind: "credit", back }}
                    submit="Verrekenen"
                  >
                    <div>
                      <label
                        htmlFor="credit-target"
                        className="block text-sm font-medium"
                      >
                        Openstaande factuur *
                      </label>
                      <select
                        id="credit-target"
                        name="target"
                        required
                        defaultValue=""
                        className="crm-input"
                      >
                        <option value="" disabled>
                          Kies een factuur
                        </option>
                        {openInvoices.data!.map((o) => (
                          <option key={o.invoice_id} value={o.invoice_id!}>
                            {o.invoice_number} — open{" "}
                            {formatEuro(o.open_amount)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Field
                      label="Bedrag (EUR)"
                      name="amount"
                      inputMode="decimal"
                      required
                    />
                  </StateForm>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Geen openstaande facturen om mee te verrekenen.
                  </p>
                )}
                <p className="mt-4 text-sm">
                  <Link
                    className="underline"
                    href={`/account/financien/betalingen/nieuw?sponsor=${inv.sponsor_id}&direction=out`}
                  >
                    Terugbetaling (restitutie) registreren
                  </Link>
                </p>
              </Card>
            )}
            {!isCredit && (
              <Card className="p-6">
                <h3 className="mb-2 font-semibold">
                  Corrigeren met creditnota
                </h3>
                {credits.data!.length > 0 && (
                  <ul className="mb-3 text-sm">
                    {credits.data!.map((c) => (
                      <li key={c.id}>
                        <Link
                          className="underline"
                          href={`/account/financien/facturen/${c.id}`}
                        >
                          {c.invoice_number || "Creditconcept"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <StateForm
                  action={createCreditNote}
                  hidden={{ id, full: "yes" }}
                  submit="Volledige creditnota opstellen"
                />
                <div className="mt-3">
                  <StateForm
                    action={createCreditNote}
                    hidden={{ id, full: "no" }}
                    submit="Lege creditnota (gedeeltelijk)"
                  />
                </div>
              </Card>
            )}
          </div>
        </section>
      )}

      {!draft && (
        <section className="mt-8" aria-labelledby="factuurdocumenten">
          <h2 id="factuurdocumenten" className="mb-2 text-xl font-semibold">
            Factuurdocument
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload de verzonden factuur-PDF. Het portaal genereert zelf (nog)
            geen PDF.
          </p>
          <ul className="mb-4 space-y-2 text-sm">
            {docs.data!.map((d) =>
              d.documents ? (
                <li key={d.documents.id}>
                  {d.documents.upload_status === "available" ? (
                    <a
                      className="underline"
                      href={`/account/documenten/${d.documents.id}`}
                    >
                      {d.documents.title}
                    </a>
                  ) : (
                    `${d.documents.title} (upload niet afgerond)`
                  )}{" "}
                  <Badge>
                    {d.documents.sponsor_shared
                      ? "Gedeeld met sponsor"
                      : "Privé"}
                  </Badge>
                </li>
              ) : null,
            )}
          </ul>
          {!inv.sponsors?.archived_at && (
            <Panel title="Factuur-PDF uploaden">
              <StateForm
                action={uploadInvoiceDocument}
                hidden={{ company: inv.sponsor_id, invoice: id }}
                submit="PDF uploaden"
              >
                <Field
                  label="Titel"
                  name="title"
                  required
                  defaultValue={inv.invoice_number ?? ""}
                />
                <Field
                  label="Bestand (PDF, max. 8 MB)"
                  name="file"
                  type="file"
                  required
                />
                <Check name="sponsor_shared" label="Delen met de sponsor" />
              </StateForm>
            </Panel>
          )}
        </section>
      )}
    </>
  );
}
