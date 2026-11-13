import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePortal } from "@/modules/portal/access";
import { Badge } from "@/components/ui/badge";
import {
  contractPhase,
  formatDate,
  formatEuro,
  rightLabels,
  todayInAmsterdam,
} from "@/modules/contracts/schema";

export default async function PortalContract({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, sponsorId } = await requirePortal();
  // Expliciete kolommen: geen interne actor-ID's of momentopnamen in de pagina.
  const contract = await client
    .from("contracts")
    .select(
      "id,contract_number,title,status,starts_on,ends_on,notice_deadline,renewal_terms,terms,terminated_on,confirmed_at",
    )
    .eq("id", id)
    .eq("sponsor_id", sponsorId)
    .maybeSingle();
  if (contract.error) throw new Error("Contract kon niet geladen worden.");
  if (!contract.data) notFound();
  const c = contract.data;
  const [lines, rights, fulfillments, amendments, docs, total] =
    await Promise.all([
      client
        .from("contract_lines")
        .select(
          "id,title,description,quantity,unit_price,line_total,amendment_id",
        )
        .eq("contract_id", id)
        .order("position"),
      client
        .from("contract_rights")
        .select("id,description,quantity,unit,deadline,status")
        .eq("contract_id", id)
        .order("position"),
      client
        .from("right_fulfillments")
        .select(
          "id,contract_right_id,fulfilled_on,quantity,description,fulfillment_evidence(document_id,documents(id,title))",
        )
        .eq("sponsor_id", sponsorId)
        .order("fulfilled_on"),
      client
        .from("contract_amendments")
        .select("id,sequence_number,effective_on,reason")
        .eq("contract_id", id)
        .order("sequence_number"),
      client
        .from("contract_documents")
        .select("document_role,documents(id,title)")
        .eq("contract_id", id),
      client
        .from("contract_totals")
        .select("current_total")
        .eq("contract_id", id)
        .maybeSingle(),
    ]);
  for (const r of [lines, rights, fulfillments, amendments, docs, total])
    if (r.error)
      throw new Error("Contractonderdelen konden niet geladen worden.");
  const today = todayInAmsterdam();
  const byRight = new Map<string, NonNullable<typeof fulfillments.data>>();
  for (const f of fulfillments.data!)
    byRight.set(f.contract_right_id, [
      ...(byRight.get(f.contract_right_id) || []),
      f,
    ]);
  return (
    <>
      <Link
        href="/account/portaal/samenwerking"
        className="mb-4 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar samenwerking
      </Link>
      <p className="eyebrow">{c.contract_number}</p>
      <h1 className="mt-2 text-3xl font-semibold break-words">{c.title}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge role="status">{contractPhase(c, today)}</Badge>
        <span>
          {formatDate(c.starts_on)} t/m {formatDate(c.ends_on)}
          {c.notice_deadline
            ? ` · opzeggen vóór ${formatDate(c.notice_deadline)}`
            : ""}
          {c.terminated_on
            ? ` · beëindigd per ${formatDate(c.terminated_on)}`
            : ""}
        </span>
      </p>

      <section className="dash-panel mt-6" aria-labelledby="afspraken">
        <h2 id="afspraken">Afspraken</h2>
        <div
          className="table-scroll mt-3"
          tabIndex={0}
          role="region"
          aria-label="Contractregels"
        >
          <table>
            <caption className="sr-only">Contractregels incl. BTW</caption>
            <thead>
              <tr>
                <th scope="col">Omschrijving</th>
                <th scope="col" className="dash-num">
                  Aantal
                </th>
                <th scope="col" className="dash-num">
                  Prijs
                </th>
                <th scope="col" className="dash-num">
                  Totaal
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.data!.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.title}
                    {l.amendment_id && (
                      <span className="block text-xs text-muted-foreground">
                        Latere aanpassing
                      </span>
                    )}
                  </td>
                  <td className="dash-num">{l.quantity}</td>
                  <td className="dash-num">{formatEuro(l.unit_price)}</td>
                  <td className="dash-num">{formatEuro(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-right text-sm font-semibold">
          Totaal incl. BTW: {formatEuro(total.data?.current_total)}
        </p>
        {(c.renewal_terms || c.terms) && (
          <dl className="crm-definition mt-4">
            {c.renewal_terms && (
              <div>
                <dt>Verlenging</dt>
                <dd className="whitespace-pre-wrap">{c.renewal_terms}</dd>
              </div>
            )}
            {c.terms && (
              <div>
                <dt>Voorwaarden</dt>
                <dd className="whitespace-pre-wrap">{c.terms}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section className="mt-6" aria-labelledby="rechten">
        <h2 id="rechten" className="mb-3 text-xl font-semibold">
          Sponsorrechten
        </h2>
        {!rights.data!.length && (
          <p className="text-sm text-muted-foreground">
            Er zijn geen sponsorrechten zichtbaar gemaakt.
          </p>
        )}
        <ul className="grid gap-3 md:grid-cols-2">
          {rights.data!.map((r) => (
            <li key={r.id} className="dash-panel">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium break-words">
                  {r.quantity} × {r.unit} — {r.description}
                </p>
                <Badge>
                  {rightLabels[r.status as keyof typeof rightLabels]}
                </Badge>
              </div>
              {r.deadline && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Gepland vóór {formatDate(r.deadline)}
                </p>
              )}
              {(byRight.get(r.id) || []).map((f) => (
                <div
                  key={f.id}
                  className="mt-3 border-t border-border pt-2 text-sm"
                >
                  <p>
                    {formatDate(f.fulfilled_on)} · {f.description}
                  </p>
                  {f.fulfillment_evidence.map((e) =>
                    e.documents ? (
                      <a
                        key={e.document_id}
                        className="inline-flex min-h-11 items-center underline"
                        href={`/account/documenten/${e.documents.id}`}
                      >
                        Bewijs: {e.documents.title}
                      </a>
                    ) : null,
                  )}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>

      {amendments.data!.length > 0 && (
        <section className="dash-panel mt-6" aria-labelledby="wijzigingen">
          <h2 id="wijzigingen">Wijzigingen</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {amendments.data!.map((a) => (
              <li key={a.id}>
                <strong>Wijziging {a.sequence_number}</strong> per{" "}
                {formatDate(a.effective_on)}: {a.reason}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="dash-panel mt-6" aria-labelledby="documenten">
        <h2 id="documenten">Documenten</h2>
        {docs.data!.filter((d) => d.documents).length ? (
          <ul className="mt-2 text-sm">
            {docs.data!.map((d) =>
              d.documents ? (
                <li key={d.documents.id}>
                  <a
                    className="inline-flex min-h-11 items-center underline"
                    href={`/account/documenten/${d.documents.id}`}
                  >
                    {d.documents.title}
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Er zijn geen documenten met je gedeeld.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Downloadlinks zijn kort geldig en worden per klik opnieuw
          gecontroleerd.
        </p>
      </section>
    </>
  );
}
