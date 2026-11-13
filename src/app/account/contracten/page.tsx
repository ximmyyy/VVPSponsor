import Link from "next/link";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import {
  contractPhase,
  formatDate,
  formatEuro,
  statusLabels,
  todayInAmsterdam,
} from "@/modules/contracts/schema";

export default async function Contracts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const params = await searchParams;
  const status =
    typeof params.status === "string" &&
    Object.hasOwn(statusLabels, params.status)
      ? params.status
      : "";
  const sponsor =
    typeof params.sponsor === "string" &&
    z.uuid().safeParse(params.sponsor).success
      ? params.sponsor
      : "";
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  let request = client
    .from("contracts")
    .select(
      "id,contract_number,title,status,starts_on,ends_on,notice_deadline,sponsor_id,sponsors(name)",
      {
        count: "exact",
      },
    )
    .order("ends_on", { ascending: false })
    .order("id");
  if (status) request = request.eq("status", status);
  if (sponsor) request = request.eq("sponsor_id", sponsor);
  const result = await request.range((page - 1) * 25, page * 25 - 1);
  if (result.error) throw new Error("Contracten konden niet geladen worden.");
  const ids = result.data.map((c) => c.id);
  const totals = ids.length
    ? await client
        .from("contract_totals")
        .select("contract_id,current_total")
        .in("contract_id", ids)
    : { data: [], error: null };
  if (totals.error)
    throw new Error("Contractwaarden konden niet geladen worden.");
  const value = new Map(
    totals.data.map((t) => [t.contract_id, t.current_total]),
  );
  const today = todayInAmsterdam();
  const href = (n: number) =>
    `/account/contracten?${new URLSearchParams({ status, sponsor, page: String(n) })}`;
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Afspraken</p>
          <h1 className="mt-2 text-3xl font-semibold">Contracten</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Een bedrijf kan meerdere contracten hebben. Contractwaarde is de som
            van vastgelegde regels en amendementen (incl. BTW); facturatie en
            betalingen staan apart onder Financiën.
          </p>
        </div>
        <Button asChild>
          <Link href="/account/contracten/nieuw">Contract opstellen</Link>
        </Button>
      </div>
      <Card className="p-5">
        <form
          method="get"
          className="grid items-end gap-4 md:grid-cols-[1fr_auto]"
        >
          {sponsor && <input type="hidden" name="sponsor" value={sponsor} />}
          <div>
            <label htmlFor="contract-status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="contract-status"
              name="status"
              defaultValue={status}
              className="crm-input"
            >
              <option value="">Alle statussen</option>
              {Object.entries(statusLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button>Toepassen</Button>
        </form>
        {sponsor && (
          <p className="mt-3 text-sm">
            Gefilterd op één bedrijf.{" "}
            <Link className="underline" href="/account/contracten">
              Filter wissen
            </Link>
          </p>
        )}
      </Card>
      <p className="my-5 text-sm text-muted-foreground">
        {result.count || 0} contracten gevonden
      </p>
      <Card className="overflow-hidden">
        {!result.data.length ? (
          <EmptyState
            title="Geen contracten gevonden"
            description="Stel een conceptcontract op vanuit een bestaand bedrijf in het CRM."
          />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Contractoverzicht"
          >
            <table>
              <caption className="sr-only">
                Contracten met status, looptijd en waarde
              </caption>
              <thead>
                <tr>
                  <th scope="col">Contract</th>
                  <th scope="col">Bedrijf</th>
                  <th scope="col">Status</th>
                  <th scope="col">Looptijd</th>
                  <th scope="col">Opzeggen vóór</th>
                  <th scope="col">Contractwaarde</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        className="inline-flex min-h-11 flex-col justify-center font-semibold text-primary underline"
                        href={`/account/contracten/${c.id}`}
                      >
                        {c.contract_number}
                        <span className="font-normal text-foreground">
                          {c.title}
                        </span>
                      </Link>
                    </td>
                    <td>{c.sponsors?.name}</td>
                    <td>{contractPhase(c, today)}</td>
                    <td>
                      {formatDate(c.starts_on)} – {formatDate(c.ends_on)}
                    </td>
                    <td>{formatDate(c.notice_deadline)}</td>
                    <td>{formatEuro(value.get(c.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <nav
        aria-label="Pagina's"
        className="mt-5 flex items-center gap-6 text-sm"
      >
        {page > 1 && (
          <Link
            className="min-h-11 content-center underline"
            href={href(page - 1)}
          >
            Vorige
          </Link>
        )}
        <span>Pagina {page}</span>
        {(result.count || 0) > page * 25 && (
          <Link
            className="min-h-11 content-center underline"
            href={href(page + 1)}
          >
            Volgende
          </Link>
        )}
      </nav>
    </>
  );
}
