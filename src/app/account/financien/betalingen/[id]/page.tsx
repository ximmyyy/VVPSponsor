import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, StateForm } from "@/modules/contracts/forms";
import {
  allocate,
  reverseAllocation,
  reversePayment,
} from "@/modules/finance/actions";
import { formatDate, formatEuro } from "@/modules/contracts/schema";
import { directionLabels, methodLabels } from "@/modules/finance/schema";

export default async function PaymentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireCrm();
  const payment = await client
    .from("payments")
    .select("*,sponsors(id,name)")
    .eq("id", id)
    .maybeSingle();
  if (payment.error) throw new Error("Betaling kon niet geladen worden.");
  if (!payment.data) notFound();
  const p = payment.data;
  const back = `/account/financien/betalingen/${id}`;
  const active = p.status === "registered";
  const [balance, allocations, targets] = await Promise.all([
    client.from("payment_balances").select("*").eq("payment_id", id).single(),
    client
      .from("payment_allocations")
      .select(
        "id,amount,created_at,reversed_at,invoice_id,invoices(invoice_number,kind)",
      )
      .eq("payment_id", id)
      .order("created_at"),
    client
      .from("invoice_balances")
      .select("invoice_id,invoice_number,open_amount,due_on")
      .eq("sponsor_id", p.sponsor_id)
      .eq("status", "issued")
      .eq("kind", p.direction === "in" ? "invoice" : "credit")
      .gt("open_amount", 0)
      .order("due_on"),
  ]);
  if (balance.error || allocations.error || targets.error)
    throw new Error("Toewijzingen konden niet geladen worden.");
  const free = balance.data.unallocated;
  return (
    <>
      <Link
        href="/account/financien?view=betalingen"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar betalingen
      </Link>
      <p className="eyebrow">
        {directionLabels[p.direction as keyof typeof directionLabels]}
      </p>
      <h1 className="my-2 text-3xl font-semibold">
        {formatEuro(p.amount)} op {formatDate(p.received_on)}
      </h1>
      <p className="text-sm">
        <Link className="underline" href={`/account/sponsors/${p.sponsor_id}`}>
          {p.sponsors?.name}
        </Link>{" "}
        · {methodLabels[p.method as keyof typeof methodLabels]}
        {p.reference ? ` · ${p.reference}` : ""}
      </p>
      <Badge role="status" className="mt-3">
        {active ? "Geregistreerd" : `Teruggedraaid: ${p.reversal_reason}`}
      </Badge>
      <Card className="mt-6 p-6 text-sm">
        <dl className="crm-definition">
          <div>
            <dt>Bedrag</dt>
            <dd>{formatEuro(p.amount)}</dd>
          </div>
          <div>
            <dt>Toegewezen</dt>
            <dd>{formatEuro(balance.data.allocated)}</dd>
          </div>
          <div>
            <dt>Niet toegewezen</dt>
            <dd>
              <strong>{formatEuro(free)}</strong>
            </dd>
          </div>
        </dl>
      </Card>
      <section className="mt-8" aria-labelledby="toewijzingen">
        <h2 id="toewijzingen" className="mb-4 text-xl font-semibold">
          Toewijzingen
        </h2>
        <Card className="space-y-3 p-6 text-sm">
          {!allocations.data.length && (
            <p className="text-muted-foreground">Nog niet toegewezen.</p>
          )}
          {allocations.data.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p
                className={
                  a.reversed_at ? "text-muted-foreground line-through" : ""
                }
              >
                <Link
                  className="underline"
                  href={`/account/financien/facturen/${a.invoice_id}`}
                >
                  {a.invoices?.invoice_number}
                </Link>
                : {formatEuro(a.amount)}
                {a.reversed_at ? " (teruggedraaid)" : ""}
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
        </Card>
        {active && Number(free) > 0 && (
          <Card className="mt-4 p-6">
            <h3 className="mb-3 font-semibold">
              Toewijzen aan {p.direction === "in" ? "factuur" : "creditnota"}
            </h3>
            {targets.data.length ? (
              <StateForm
                action={allocate}
                hidden={{ source: id, kind: "payment", back }}
                submit="Toewijzen"
              >
                <div>
                  <label
                    htmlFor="alloc-target"
                    className="block text-sm font-medium"
                  >
                    {p.direction === "in"
                      ? "Openstaande factuur *"
                      : "Creditnota met tegoed *"}
                  </label>
                  <select
                    id="alloc-target"
                    name="target"
                    required
                    defaultValue=""
                    className="crm-input"
                  >
                    <option value="" disabled>
                      Kies
                    </option>
                    {targets.data.map((t) => (
                      <option key={t.invoice_id} value={t.invoice_id!}>
                        {t.invoice_number} — open {formatEuro(t.open_amount)}
                        {t.due_on ? `, vervalt ${formatDate(t.due_on)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Bedrag (EUR)"
                  name="amount"
                  inputMode="decimal"
                  required
                  hint={`Maximaal ${formatEuro(free)} niet-toegewezen en het openstaande bedrag.`}
                />
              </StateForm>
            ) : (
              <p className="text-sm text-muted-foreground">
                Geen openstaande{" "}
                {p.direction === "in" ? "facturen" : "creditnota's"} voor dit
                bedrijf. Het bedrag blijft zichtbaar als niet toegewezen.
              </p>
            )}
          </Card>
        )}
      </section>
      {active && (
        <Card className="mt-8 p-6">
          <h2 className="mb-2 text-lg font-semibold">Betaling terugdraaien</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Voor een foutieve of dubbele registratie. Alle toewijzingen worden
            mee teruggedraaid; de historie blijft bewaard.
          </p>
          <StateForm
            action={reversePayment}
            hidden={{ id }}
            submit="Betaling terugdraaien"
            variant="destructive"
            confirm="Betaling en alle toewijzingen terugdraaien?"
          >
            <Field label="Reden" name="reason" required />
          </StateForm>
        </Card>
      )}
    </>
  );
}
