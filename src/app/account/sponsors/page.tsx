import Link from "next/link";
import { requireCrm } from "@/modules/crm/access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import { statusLabels } from "@/modules/crm/schema";
export default async function Sponsors({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status =
    typeof params.status === "string" &&
    Object.hasOwn(statusLabels, params.status)
      ? params.status
      : "";
  const archived = params.archived === "yes";
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(params.page || 1), 10) || 1),
  );
  let request = client
    .from("sponsors")
    .select("id,name,city,archived_at,sponsor_internal!inner(status)", {
      count: "exact",
    })
    .order("name")
    .order("id");
  request = archived
    ? request.not("archived_at", "is", null)
    : request.is("archived_at", null);
  if (query)
    request = request.ilike("name", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
  if (status) request = request.eq("sponsor_internal.status", status);
  const result = await request.range((page - 1) * 25, page * 25 - 1);
  if (result.error)
    throw new Error("Het sponsoroverzicht kon niet worden geladen.");
  const href = (n: number) =>
    `/account/sponsors?${new URLSearchParams({ q: query, status, archived: archived ? "yes" : "no", page: String(n) })}`;
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Relatiebeheer</p>
          <h1 className="mt-2 text-3xl font-semibold">Sponsors</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Eén bedrijfsrecord voor prospect én sponsor.
          </p>
        </div>
        <Button asChild>
          <Link href="/account/sponsors/nieuw">Bedrijf toevoegen</Link>
        </Button>
      </div>
      <Card className="p-5">
        <form
          className="grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr_auto]"
          method="get"
        >
          <div>
            <label htmlFor="crm-search" className="text-sm font-medium">
              Zoek op bedrijfsnaam
            </label>
            <input
              id="crm-search"
              name="q"
              defaultValue={query}
              maxLength={100}
              className="crm-input"
              type="search"
            />
          </div>
          <div>
            <label htmlFor="crm-status" className="text-sm font-medium">
              Relatiestatus
            </label>
            <select
              id="crm-status"
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
          <div>
            <label htmlFor="crm-archive" className="text-sm font-medium">
              Weergave
            </label>
            <select
              id="crm-archive"
              name="archived"
              defaultValue={archived ? "yes" : "no"}
              className="crm-input"
            >
              <option value="no">Niet gearchiveerd</option>
              <option value="yes">Gearchiveerd</option>
            </select>
          </div>
          <Button>Toepassen</Button>
        </form>
      </Card>
      <p className="my-5 text-sm text-muted-foreground">
        {result.count || 0} bedrijven gevonden
      </p>
      <Card className="overflow-hidden">
        {!result.data.length ? (
          <EmptyState
            title="Geen bedrijven gevonden"
            description="Pas de filters aan of voeg een bedrijf toe. Zoek ook in het archief voordat je een nieuwe relatie aanmaakt."
          />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Sponsoroverzicht"
          >
            <table>
              <caption className="sr-only">
                Sponsorbedrijven en relatiestatus
              </caption>
              <thead>
                <tr>
                  <th scope="col">Bedrijf</th>
                  <th scope="col">Plaats</th>
                  <th scope="col">Relatiestatus</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <Link
                        className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                        href={`/account/sponsors/${company.id}`}
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td>{company.city || "—"}</td>
                    <td>
                      {
                        statusLabels[
                          company.sponsor_internal
                            .status as keyof typeof statusLabels
                        ]
                      }
                    </td>
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
