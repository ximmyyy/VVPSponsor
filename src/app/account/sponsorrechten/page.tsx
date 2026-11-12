import Link from "next/link";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import {
  formatDate,
  rightLabels,
  todayInAmsterdam,
} from "@/modules/contracts/schema";

export default async function Rights({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client, user } = await requireCrm();
  const params = await searchParams;
  const mine = params.mine === "yes";
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  let request = client
    .from("contract_rights")
    .select(
      "id,description,quantity,unit,deadline,status,responsible_id,contract_id,contracts!inner(contract_number,status,sponsors(name))",
      { count: "exact" },
    )
    .in("status", ["open", "in_progress"])
    .eq("contracts.status", "confirmed")
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("id");
  if (mine) request = request.eq("responsible_id", user.id);
  const [result, owners] = await Promise.all([
    request.range((page - 1) * 50, page * 50 - 1),
    client.rpc("crm_owners"),
  ]);
  if (result.error || owners.error)
    throw new Error("Sponsorrechten konden niet geladen worden.");
  const label = (id: string | null) =>
    id
      ? owners.data.find((o) => o.user_id === id)?.label ||
        "Eerder toegewezen account"
      : "Niet toegewezen";
  const today = todayInAmsterdam();
  const href = (n: number) =>
    `/account/sponsorrechten?${new URLSearchParams({ mine: mine ? "yes" : "no", page: String(n) })}`;
  return (
    <>
      <p className="eyebrow">Uitvoering</p>
      <h1 className="mt-2 text-3xl font-semibold">
        Openstaande sponsorrechten
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Rechten van bevestigde contracten die nog niet zijn uitgevoerd, op
        deadline gesorteerd. Herinneringen per e-mail volgen pas in fase 9.
      </p>
      <nav aria-label="Filter" className="my-5 flex gap-5 text-sm">
        <Link
          className="min-h-11 content-center underline"
          aria-current={!mine ? "page" : undefined}
          href="/account/sponsorrechten"
        >
          Alle openstaande rechten
        </Link>
        <Link
          className="min-h-11 content-center underline"
          aria-current={mine ? "page" : undefined}
          href="/account/sponsorrechten?mine=yes"
        >
          Mijn verantwoordelijkheid
        </Link>
      </nav>
      <p className="mb-4 text-sm text-muted-foreground">
        {result.count || 0} rechten
      </p>
      <Card className="overflow-hidden">
        {!result.data.length ? (
          <EmptyState
            title="Geen openstaande rechten"
            description="Er zijn geen open of lopende rechten bij bevestigde contracten."
          />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Openstaande sponsorrechten"
          >
            <table>
              <caption className="sr-only">
                Openstaande sponsorrechten met deadline
              </caption>
              <thead>
                <tr>
                  <th scope="col">Deadline</th>
                  <th scope="col">Recht</th>
                  <th scope="col">Bedrijf en contract</th>
                  <th scope="col">Status</th>
                  <th scope="col">Verantwoordelijke</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((r) => {
                  const late = r.deadline !== null && r.deadline < today;
                  return (
                    <tr key={r.id}>
                      <td>
                        {formatDate(r.deadline)}
                        {late && (
                          <strong className="block text-destructive">
                            Verlopen
                          </strong>
                        )}
                      </td>
                      <td>
                        {r.quantity} × {r.unit} — {r.description}
                      </td>
                      <td>
                        <Link
                          className="inline-flex min-h-11 flex-col justify-center underline"
                          href={`/account/contracten/${r.contract_id}`}
                        >
                          {r.contracts.sponsors?.name}
                          <span className="text-xs">
                            {r.contracts.contract_number}
                          </span>
                        </Link>
                      </td>
                      <td>
                        {rightLabels[r.status as keyof typeof rightLabels]}
                      </td>
                      <td>{label(r.responsible_id)}</td>
                    </tr>
                  );
                })}
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
        {(result.count || 0) > page * 50 && (
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
