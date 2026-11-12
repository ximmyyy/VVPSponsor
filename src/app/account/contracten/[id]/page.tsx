import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { ReactNode } from "react";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ContractForm,
  Field,
  StateForm,
} from "@/modules/contracts/forms";
import {
  addAmendment,
  addLine,
  addRight,
  confirmContract,
  registerFulfillment,
  removeItem,
  renewContract,
  reviewFulfillment,
  shareDocument,
  terminateContract,
  updateRight,
  uploadDocument,
} from "@/modules/contracts/actions";
import {
  contractPhase,
  formatDate,
  formatEuro,
  rightLabels,
  todayInAmsterdam,
} from "@/modules/contracts/schema";

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

export default async function ContractDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireCrm();
  const contract = await client
    .from("contracts")
    .select("*,sponsors(id,name,archived_at)")
    .eq("id", id)
    .maybeSingle();
  if (contract.error) throw new Error("Contract kon niet geladen worden.");
  if (!contract.data) notFound();
  const c = contract.data;
  const [
    lines,
    rights,
    fulfillments,
    amendments,
    docs,
    totals,
    successor,
    owners,
    versions,
  ] = await Promise.all([
    client
      .from("contract_lines")
      .select("*")
      .eq("contract_id", id)
      .order("position")
      .order("created_at"),
    client
      .from("contract_rights")
      .select("*")
      .eq("contract_id", id)
      .order("position")
      .order("created_at"),
    client
      .from("right_fulfillments")
      .select(
        "*,fulfillment_evidence(document_id,documents(id,title,sponsor_shared,upload_status))",
      )
      .eq("sponsor_id", c.sponsor_id)
      .order("fulfilled_on"),
    client
      .from("contract_amendments")
      .select("*")
      .eq("contract_id", id)
      .order("sequence_number"),
    client
      .from("contract_documents")
      .select(
        "document_role,documents(id,title,sponsor_shared,upload_status,mime_type,created_at)",
      )
      .eq("contract_id", id),
    client
      .from("contract_totals")
      .select("*")
      .eq("contract_id", id)
      .maybeSingle(),
    client
      .from("contracts")
      .select("id,contract_number")
      .eq("predecessor_contract_id", id)
      .maybeSingle(),
    client.rpc("crm_owners"),
    c.status === "draft"
      ? client
          .from("package_versions")
          .select(
            "id,version_number,list_price,sponsorship_packages!inner(name,archived_at)",
          )
          .eq("status", "published")
          .is("sponsorship_packages.archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [
    lines,
    rights,
    fulfillments,
    amendments,
    docs,
    totals,
    successor,
    owners,
    versions,
  ])
    if (r.error)
      throw new Error("Contractonderdelen konden niet geladen worden.");
  const predecessor = c.predecessor_contract_id
    ? (
        await client
          .from("contracts")
          .select("id,contract_number")
          .eq("id", c.predecessor_contract_id)
          .maybeSingle()
      ).data
    : null;
  const invoicing = await client
    .from("contract_invoicing")
    .select("contract_value,invoiced_net,to_invoice")
    .eq("contract_id", id)
    .maybeSingle();
  if (invoicing.error)
    throw new Error("Facturatiestand kon niet geladen worden.");
  const draft = c.status === "draft";
  const confirmed = c.status === "confirmed";
  const ownerLabel = (uid: string | null) =>
    uid
      ? owners.data!.find((o) => o.user_id === uid)?.label ||
        "Eerder toegewezen account"
      : "Niet toegewezen";
  const rightIds = new Set(rights.data!.map((r) => r.id));
  const byRight = new Map<string, typeof fulfillments.data>();
  for (const f of fulfillments.data!)
    if (rightIds.has(f.contract_right_id))
      byRight.set(f.contract_right_id, [
        ...(byRight.get(f.contract_right_id) || []),
        f,
      ]);
  const amendmentNo = new Map(
    amendments.data!.map((a) => [a.id, a.sequence_number]),
  );
  const snapshot = (c.party_snapshot || {}) as Record<string, string | null>;
  const today = todayInAmsterdam();
  const hidden = { contract: id };

  return (
    <>
      <Link
        href="/account/contracten"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar contracten
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{c.contract_number}</p>
          <h1 className="my-2 break-words text-3xl font-semibold">{c.title}</h1>
          <p className="text-sm">
            <Link
              className="underline"
              href={`/account/sponsors/${c.sponsor_id}`}
            >
              {c.sponsors?.name}
            </Link>
          </p>
          <Badge role="status" className="mt-3">
            {contractPhase(c, today)}
          </Badge>
        </div>
        <Card className="p-5 text-sm">
          <p>
            Contractwaarde:{" "}
            <strong>{formatEuro(totals.data?.current_total)}</strong>
          </p>
          {totals.data &&
            totals.data.current_total !== totals.data.baseline_total && (
              <p className="text-muted-foreground">
                Oorspronkelijk vastgelegd:{" "}
                {formatEuro(totals.data.baseline_total)}
              </p>
            )}
          <p className="mt-1 text-xs text-muted-foreground">
            Som van regels incl. BTW; los van facturatie.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Looptijd en afspraken</h2>
          <dl className="crm-definition">
            {[
              ["Begindatum", formatDate(c.starts_on)],
              ["Einddatum", formatDate(c.ends_on)],
              ["Opzeggen vóór", formatDate(c.notice_deadline)],
              ["Verlengafspraken", c.renewal_terms || "—"],
              ["Voorwaarden", c.terms || "—"],
              [
                "Bevestigd",
                c.confirmed_at
                  ? `${formatDate(c.confirmed_at)} door ${ownerLabel(c.confirmed_by)}`
                  : "Nog niet",
              ],
              ...(c.status === "terminated"
                ? [
                    [
                      "Beëindigd per",
                      `${formatDate(c.terminated_on)} — ${c.termination_reason}`,
                    ],
                  ]
                : []),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
          </dl>
          {(predecessor || successor.data) && (
            <p className="mt-4 text-sm">
              {predecessor && (
                <>
                  Verlenging van{" "}
                  <Link
                    className="underline"
                    href={`/account/contracten/${predecessor.id}`}
                  >
                    {predecessor.contract_number}
                  </Link>
                  .{" "}
                </>
              )}
              {successor.data && (
                <>
                  Opgevolgd door{" "}
                  <Link
                    className="underline"
                    href={`/account/contracten/${successor.data.id}`}
                  >
                    {successor.data.contract_number}
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Partijgegevens</h2>
          {draft ? (
            <p className="text-sm text-muted-foreground">
              Bij bevestigen worden de actuele bedrijfsgegevens als momentopname
              vastgelegd. Latere CRM-wijzigingen veranderen dit contract niet.
            </p>
          ) : (
            <dl className="crm-definition mt-4">
              {[
                ["Bedrijfsnaam", snapshot.name],
                ["Handelsnaam", snapshot.trading_name],
                ["KvK-nummer", snapshot.kvk],
                ["BTW-nummer", snapshot.vat_number],
                [
                  "Adres",
                  [snapshot.street, snapshot.postal_code, snapshot.city]
                    .filter(Boolean)
                    .join(", "),
                ],
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

      {!draft && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="mb-2 text-lg font-semibold">Facturatie</h2>
            <p className="text-sm">
              Contractwaarde {formatEuro(invoicing.data?.contract_value)} ·
              gefactureerd (na credits){" "}
              {formatEuro(invoicing.data?.invoiced_net)} · nog te factureren{" "}
              <strong>{formatEuro(invoicing.data?.to_invoice)}</strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ontvangen betalingen staan per factuur onder Financiën.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center underline"
              href={`/account/financien/facturen/nieuw?sponsor=${c.sponsor_id}&contract=${id}`}
            >
              Factuur opstellen
            </Link>
            <Link
              className="inline-flex min-h-11 items-center underline"
              href={`/account/financien?sponsor=${c.sponsor_id}`}
            >
              Facturen van dit bedrijf
            </Link>
          </div>
        </Card>
      )}

      {draft && (
        <Card className="mt-6 p-6">
          <h2 className="mb-5 text-lg font-semibold">Concept bewerken</h2>
          <ContractForm
            company={c.sponsor_id}
            id={id}
            values={{
              title: c.title,
              starts_on: c.starts_on,
              ends_on: c.ends_on,
              notice_deadline: c.notice_deadline ?? "",
              renewal_terms: c.renewal_terms ?? "",
              terms: c.terms ?? "",
            }}
          />
        </Card>
      )}

      <section className="mt-8" aria-labelledby="regels">
        <h2 id="regels" className="mb-4 text-xl font-semibold">
          Contractregels
        </h2>
        <Card className="overflow-hidden">
          {!lines.data!.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nog geen regels. Een contract vereist minimaal één regel.
            </p>
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Contractregels"
            >
              <table>
                <caption className="sr-only">
                  Regels met hoeveelheid, prijs en herkomst
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Omschrijving</th>
                    <th scope="col">Aantal</th>
                    <th scope="col">Prijs per stuk</th>
                    <th scope="col">BTW</th>
                    <th scope="col">Regeltotaal</th>
                    <th scope="col">Herkomst</th>
                    {draft && <th scope="col">Actie</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.data!.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.title}</strong>
                        {l.description && (
                          <span className="block text-xs text-muted-foreground">
                            {l.description}
                          </span>
                        )}
                      </td>
                      <td>{l.quantity}</td>
                      <td>{formatEuro(l.unit_price)}</td>
                      <td>{l.vat_rate === null ? "—" : `${l.vat_rate}%`}</td>
                      <td>{formatEuro(l.line_total)}</td>
                      <td>
                        {l.amendment_id
                          ? `Amendement ${amendmentNo.get(l.amendment_id)}`
                          : l.package_version_id
                            ? "Pakketversie (momentopname)"
                            : "Maatwerk"}
                      </td>
                      {draft && (
                        <td>
                          <StateForm
                            action={removeItem}
                            hidden={{ ...hidden, id: l.id, kind: "line" }}
                            submit="Verwijderen"
                            confirm="Regel en bijbehorende rechten uit het concept verwijderen?"
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
            <Panel title="Regel uit pakketversie toevoegen">
              {versions.data!.length ? (
                <StateForm
                  action={addLine}
                  hidden={{
                    ...hidden,
                    title: "",
                    unit_price: "",
                    vat_rate: "",
                    description: "",
                  }}
                  submit="Pakketregel toevoegen"
                >
                  <div>
                    <label
                      htmlFor="line-version"
                      className="block text-sm font-medium"
                    >
                      Gepubliceerde pakketversie *
                    </label>
                    <select
                      id="line-version"
                      name="package_version_id"
                      required
                      className="crm-input"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Kies een versie
                      </option>
                      {versions.data!.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sponsorship_packages.name} — versie{" "}
                          {v.version_number} ({formatEuro(v.list_price)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Aantal"
                    name="quantity"
                    defaultValue="1"
                    inputMode="decimal"
                    required
                  />
                  <Check
                    name="copy_rights"
                    label="Standaardrechten als eigen afspraken kopiëren"
                    defaultChecked
                  />
                  <p className="text-xs text-muted-foreground">
                    Prijs en rechten worden gekopieerd; een latere
                    pakketwijziging verandert dit contract niet. Afwijkende
                    prijs? Gebruik een maatwerkregel.
                  </p>
                </StateForm>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Er is geen gepubliceerde pakketversie.{" "}
                  <Link className="underline" href="/account/pakketten">
                    Beheer pakketten
                  </Link>{" "}
                  of voeg een maatwerkregel toe.
                </p>
              )}
            </Panel>
            <Panel title="Maatwerkregel toevoegen">
              <StateForm
                action={addLine}
                hidden={{ ...hidden, package_version_id: "" }}
                submit="Maatwerkregel toevoegen"
              >
                <Field label="Titel" name="title" required />
                <Field label="Omschrijving" name="description" />
                <div className="crm-fields">
                  <Field
                    label="Aantal"
                    name="quantity"
                    defaultValue="1"
                    inputMode="decimal"
                    required
                  />
                  <Field
                    label="Prijs per stuk (EUR)"
                    name="unit_price"
                    inputMode="decimal"
                    required
                  />
                  <Field
                    label="BTW-tarief (%)"
                    name="vat_rate"
                    inputMode="decimal"
                    hint="Prijzen zijn incl. BTW; leeg = 21% bij facturatie."
                  />
                </div>
              </StateForm>
            </Panel>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="rechten">
        <h2 id="rechten" className="mb-2 text-xl font-semibold">
          Sponsorrechten en uitvoering
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Afgesproken rechten zijn na bevestiging vastgelegd. Status, deadline,
          verantwoordelijke en portaalzichtbaarheid blijven beheerbaar.
          Uitvoering en bewijs worden apart geregistreerd.
        </p>
        {!rights.data!.length && (
          <p className="text-sm text-muted-foreground">
            Nog geen sponsorrechten.
          </p>
        )}
        <div className="space-y-4">
          {rights.data!.map((r) => {
            const done = byRight.get(r.id) || [];
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="break-words font-semibold">
                      {r.quantity} × {r.unit} — {r.description}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Deadline {formatDate(r.deadline)} ·{" "}
                      {ownerLabel(r.responsible_id)} ·{" "}
                      {r.portal_visible
                        ? "Zichtbaar in portaal"
                        : "Alleen intern"}
                      {r.amendment_id &&
                        ` · toegevoegd bij amendement ${amendmentNo.get(r.amendment_id)}`}
                      {r.cancelled_by_amendment_id &&
                        ` · geannuleerd bij amendement ${amendmentNo.get(r.cancelled_by_amendment_id)}`}
                    </p>
                  </div>
                  <Badge role="status">
                    {rightLabels[r.status as keyof typeof rightLabels]}
                  </Badge>
                </div>
                {done.length > 0 && (
                  <ul className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                    {done.map((f) => (
                      <li
                        key={f.id}
                        className={
                          f.voided_at
                            ? "text-muted-foreground line-through"
                            : ""
                        }
                      >
                        <p>
                          {formatDate(f.fulfilled_on)} · {f.quantity} —{" "}
                          {f.description}{" "}
                          <span className="no-underline">
                            {f.voided_at ? (
                              <Badge>Ongedaan: {f.void_reason}</Badge>
                            ) : (
                              <>
                                <Badge>
                                  {f.verified_at
                                    ? "Gecontroleerd"
                                    : "Niet gecontroleerd"}
                                </Badge>{" "}
                                <Badge>
                                  {f.portal_visible ? "Gedeeld" : "Intern"}
                                </Badge>
                              </>
                            )}
                          </span>
                        </p>
                        {f.fulfillment_evidence.map((e) =>
                          e.documents ? (
                            <p key={e.document_id} className="mt-1">
                              Bewijs:{" "}
                              {e.documents.upload_status === "available" ? (
                                <a
                                  className="underline"
                                  href={`/account/documenten/${e.documents.id}`}
                                >
                                  {e.documents.title}
                                </a>
                              ) : (
                                `${e.documents.title} (upload niet afgerond)`
                              )}{" "}
                              {e.documents.sponsor_shared
                                ? "· gedeeld"
                                : "· privé"}
                            </p>
                          ) : null,
                        )}
                        {!f.voided_at && (
                          <div className="mt-2 flex flex-wrap gap-3">
                            {!f.verified_at && (
                              <StateForm
                                action={reviewFulfillment}
                                hidden={{
                                  ...hidden,
                                  id: f.id,
                                  action: "verify",
                                }}
                                submit="Markeer gecontroleerd"
                              />
                            )}
                            <StateForm
                              action={reviewFulfillment}
                              hidden={{
                                ...hidden,
                                id: f.id,
                                action: f.portal_visible ? "unshare" : "share",
                              }}
                              submit={
                                f.portal_visible
                                  ? "Niet meer delen"
                                  : "Delen met sponsor"
                              }
                            />
                            <Panel title="Registratie ongedaan maken">
                              <StateForm
                                action={reviewFulfillment}
                                hidden={{ ...hidden, id: f.id, action: "void" }}
                                submit="Ongedaan maken"
                                variant="destructive"
                              >
                                <Field label="Reden" name="reason" required />
                              </StateForm>
                            </Panel>
                            <Panel title="Bewijsstuk toevoegen">
                              <StateForm
                                action={uploadDocument}
                                hidden={{
                                  ...hidden,
                                  company: c.sponsor_id,
                                  fulfillment: f.id,
                                }}
                                submit="Bewijs uploaden"
                              >
                                <Field label="Titel" name="title" required />
                                <Field
                                  label="Bestand (PDF, PNG of JPEG, max. 8 MB)"
                                  name="file"
                                  type="file"
                                  required
                                />
                                <Check
                                  name="sponsor_shared"
                                  label="Delen met de sponsor"
                                />
                              </StateForm>
                            </Panel>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {r.status !== "cancelled" && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(draft || confirmed) && (
                      <Panel title="Planning en status bijwerken">
                        <StateForm
                          action={updateRight}
                          hidden={{ ...hidden, id: r.id }}
                          submit="Recht bijwerken"
                        >
                          <Field
                            label="Deadline"
                            name="deadline"
                            type="date"
                            defaultValue={r.deadline ?? ""}
                          />
                          <div>
                            <label
                              htmlFor={`resp-${r.id}`}
                              className="block text-sm font-medium"
                            >
                              Verantwoordelijke
                            </label>
                            <select
                              id={`resp-${r.id}`}
                              name="responsible_id"
                              defaultValue={r.responsible_id ?? ""}
                              className="crm-input"
                            >
                              <option value="">Niet toegewezen</option>
                              {owners.data!.map((o) => (
                                <option key={o.user_id} value={o.user_id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor={`status-${r.id}`}
                              className="block text-sm font-medium"
                            >
                              Status
                            </label>
                            <select
                              id={`status-${r.id}`}
                              name="status"
                              defaultValue={r.status}
                              className="crm-input"
                            >
                              {(
                                ["open", "in_progress", "fulfilled"] as const
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {rightLabels[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Check
                            name="portal_visible"
                            label="Zichtbaar in sponsorportaal"
                            defaultChecked={r.portal_visible}
                          />
                        </StateForm>
                      </Panel>
                    )}
                    {!draft && (
                      <Panel title="Uitvoering registreren">
                        <StateForm
                          action={registerFulfillment}
                          hidden={{ ...hidden, right: r.id }}
                          submit="Uitvoering opslaan"
                        >
                          <Field
                            label="Uitvoerdatum"
                            name="fulfilled_on"
                            type="date"
                            required
                            defaultValue={today}
                          />
                          <Field
                            label="Hoeveelheid"
                            name="quantity"
                            defaultValue="1"
                            inputMode="decimal"
                            required
                          />
                          <Field
                            label="Omschrijving (gedeeld bewijs)"
                            name="description"
                            required
                          />
                          <Check
                            name="portal_visible"
                            label="Delen met de sponsor"
                          />
                        </StateForm>
                      </Panel>
                    )}
                    {draft && (
                      <StateForm
                        action={removeItem}
                        hidden={{ ...hidden, id: r.id, kind: "right" }}
                        submit="Recht verwijderen"
                        confirm="Recht uit het concept verwijderen?"
                      />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        {draft && (
          <div className="mt-4">
            <Panel title="Extra sponsorrecht toevoegen">
              <StateForm
                action={addRight}
                hidden={hidden}
                submit="Recht toevoegen"
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
                  <Field label="Eenheid" name="unit" required />
                  <Field label="Deadline" name="deadline" type="date" />
                </div>
                <input type="hidden" name="responsible_id" value="" />
                <Check
                  name="portal_visible"
                  label="Zichtbaar in sponsorportaal"
                  defaultChecked
                />
              </StateForm>
            </Panel>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="amendementen">
        <h2 id="amendementen" className="mb-4 text-xl font-semibold">
          Amendementen
        </h2>
        {!amendments.data!.length && (
          <p className="text-sm text-muted-foreground">Geen amendementen.</p>
        )}
        <ol className="space-y-3">
          {amendments.data!.map((a) => {
            const ch = a.changes as {
              previous?: { ends_on?: string; notice_deadline?: string | null };
              new?: { ends_on?: string; notice_deadline?: string | null };
              added_lines?: string[];
              added_rights?: string[];
              cancelled_rights?: string[];
            };
            return (
              <li key={a.id}>
                <Card className="p-5 text-sm">
                  <p className="font-semibold">
                    Amendement {a.sequence_number} · ingang{" "}
                    {formatDate(a.effective_on)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{a.reason}</p>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {ch.previous?.ends_on && (
                      <li>
                        Einddatum {formatDate(ch.previous.ends_on)} →{" "}
                        {formatDate(ch.new?.ends_on)}; opzegdatum{" "}
                        {formatDate(ch.previous.notice_deadline)} →{" "}
                        {formatDate(ch.new?.notice_deadline)}
                      </li>
                    )}
                    {!!ch.added_lines?.length && (
                      <li>{ch.added_lines.length} regel(s) toegevoegd</li>
                    )}
                    {!!ch.added_rights?.length && (
                      <li>{ch.added_rights.length} recht(en) toegevoegd</li>
                    )}
                    {!!ch.cancelled_rights?.length && (
                      <li>
                        {ch.cancelled_rights.length} recht(en) geannuleerd
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Vastgelegd {formatDate(a.created_at)} door{" "}
                    {ownerLabel(a.created_by)}
                  </p>
                </Card>
              </li>
            );
          })}
        </ol>
        {confirmed && (
          <div className="mt-4">
            <Panel title="Amendement vastleggen">
              <StateForm
                action={addAmendment}
                hidden={{ id }}
                submit="Amendement vastleggen"
                confirm="Een amendement is definitief en wordt toegevoegd aan de historie. Doorgaan?"
              >
                <div className="crm-fields">
                  <Field
                    label="Ingangsdatum"
                    name="effective_on"
                    type="date"
                    required
                    defaultValue={today}
                  />
                  <Field
                    label="Nieuwe einddatum"
                    name="ends_on"
                    type="date"
                    hint="Laat leeg om ongewijzigd te laten."
                  />
                </div>
                <Field label="Reden" name="reason" required />
                <fieldset className="space-y-2">
                  <legend className="font-medium">Opzegdatum</legend>
                  <Check name="change_notice" label="Opzegdatum wijzigen" />
                  <Field
                    label="Nieuwe opzegdatum (leeg = geen)"
                    name="notice_deadline"
                    type="date"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="font-medium">
                    Regel toevoegen (optioneel)
                  </legend>
                  <Field label="Titel" name="line_title" />
                  <div className="crm-fields">
                    <Field
                      label="Aantal"
                      name="line_quantity"
                      defaultValue="1"
                      inputMode="decimal"
                    />
                    <Field
                      label="Prijs per stuk (EUR, negatief voor korting)"
                      name="line_unit_price"
                    />
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="font-medium">
                    Recht toevoegen (optioneel)
                  </legend>
                  <Field label="Omschrijving" name="right_description" />
                  <div className="crm-fields">
                    <Field
                      label="Aantal"
                      name="right_quantity"
                      defaultValue="1"
                      inputMode="decimal"
                    />
                    <Field label="Eenheid" name="right_unit" />
                    <Field label="Deadline" name="right_deadline" type="date" />
                  </div>
                  <Check
                    name="right_portal_visible"
                    label="Zichtbaar in sponsorportaal"
                    defaultChecked
                  />
                </fieldset>
                {rights.data!.some((r) => r.status !== "cancelled") && (
                  <fieldset className="space-y-1">
                    <legend className="font-medium">
                      Rechten annuleren (optioneel)
                    </legend>
                    {rights
                      .data!.filter((r) => r.status !== "cancelled")
                      .map((r) => (
                        <label
                          key={r.id}
                          className="flex min-h-11 items-center gap-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="cancel_rights"
                            value={r.id}
                          />{" "}
                          {r.description}
                        </label>
                      ))}
                  </fieldset>
                )}
              </StateForm>
            </Panel>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="documenten">
        <h2 id="documenten" className="mb-2 text-xl font-semibold">
          Contractdocumenten
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Standaard privé. Downloadlinks zijn 60 seconden geldig en worden per
          aanvraag opnieuw geautoriseerd.
        </p>
        {!docs.data!.length && (
          <p className="text-sm text-muted-foreground">Geen documenten.</p>
        )}
        <ul className="space-y-3">
          {docs.data!.map((d) =>
            d.documents ? (
              <li
                key={d.documents.id}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span>
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
                  <Badge>{d.document_role}</Badge>{" "}
                  <Badge>
                    {d.documents.sponsor_shared
                      ? "Gedeeld met sponsor"
                      : "Privé"}
                  </Badge>
                </span>
                <StateForm
                  action={shareDocument}
                  hidden={{
                    ...hidden,
                    id: d.documents.id,
                    share: d.documents.sponsor_shared ? "no" : "yes",
                  }}
                  submit={
                    d.documents.sponsor_shared
                      ? "Delen intrekken"
                      : "Delen met sponsor"
                  }
                />
              </li>
            ) : null,
          )}
        </ul>
        {!c.sponsors?.archived_at && (
          <div className="mt-4">
            <Panel title="Document uploaden">
              <StateForm
                action={uploadDocument}
                hidden={{ ...hidden, company: c.sponsor_id }}
                submit="Document uploaden"
              >
                <Field label="Titel" name="title" required />
                <div>
                  <label
                    htmlFor="doc-role"
                    className="block text-sm font-medium"
                  >
                    Soort
                  </label>
                  <select
                    id="doc-role"
                    name="role"
                    className="crm-input"
                    defaultValue="contract"
                  >
                    <option value="contract">Contract</option>
                    <option value="amendment">Amendement</option>
                    <option value="annex">Bijlage</option>
                    <option value="other">Overig</option>
                  </select>
                </div>
                <Field
                  label="Bestand (PDF, PNG of JPEG, max. 8 MB)"
                  name="file"
                  type="file"
                  required
                />
                <Check name="sponsor_shared" label="Delen met de sponsor" />
                <Check name="board_shared" label="Vrijgeven aan clubbestuur" />
              </StateForm>
            </Panel>
          </div>
        )}
      </section>

      <section
        className="mt-8 grid gap-4 lg:grid-cols-2"
        aria-label="Contracthandelingen"
      >
        {draft && (
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold">Contract bevestigen</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Legt regels, rechten en partijgegevens in één handeling vast.
              Daarna zijn wijzigingen alleen via een amendement mogelijk en ziet
              de sponsor het contract. Dit is geen digitale ondertekening.
            </p>
            <StateForm
              action={confirmContract}
              hidden={{ id }}
              submit="Contract bevestigen"
              variant="default"
              confirm="Contract definitief bevestigen?"
            />
          </Card>
        )}
        {!draft && !successor.data && (
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold">Verlengen</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Maakt een nieuw concept met de actuele regels en niet-geannuleerde
              rechten. Er is geen automatische verlenging.
            </p>
            <StateForm
              action={renewContract}
              hidden={{ id }}
              submit="Verlengingsconcept maken"
            >
              <Field
                label="Titel"
                name="title"
                defaultValue={c.title}
                required
              />
              <div className="crm-fields">
                <Field
                  label="Begindatum"
                  name="starts_on"
                  type="date"
                  required
                />
                <Field label="Einddatum" name="ends_on" type="date" required />
              </div>
              <Field
                label="Uiterste opzegdatum"
                name="notice_deadline"
                type="date"
              />
            </StateForm>
          </Card>
        )}
        {confirmed && (
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold">Beëindigen</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Beëindigen bewaart alle afspraken en historie.
            </p>
            <StateForm
              action={terminateContract}
              hidden={{ id }}
              submit="Contract beëindigen"
              variant="destructive"
              confirm="Contract definitief beëindigen?"
            >
              <Field
                label="Beëindigd per"
                name="terminated_on"
                type="date"
                required
              />
              <Field label="Reden" name="reason" required />
            </StateForm>
          </Card>
        )}
      </section>
    </>
  );
}
