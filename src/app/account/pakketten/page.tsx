import Link from "next/link";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { PackageForm } from "@/modules/contracts/forms";
import { formatEuro, versionLabels } from "@/modules/contracts/schema";

export default async function Packages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const archived = (await searchParams).archived === "yes";
  let request = client
    .from("sponsorship_packages")
    .select(
      "id,name,description,archived_at,package_versions(id,version_number,status,list_price)",
    )
    .order("name");
  request = archived
    ? request.not("archived_at", "is", null)
    : request.is("archived_at", null);
  const result = await request;
  if (result.error) throw new Error("Pakketten konden niet geladen worden.");
  return (
    <>
      <p className="eyebrow">Commercieel aanbod</p>
      <h1 className="mt-2 text-3xl font-semibold">Sponsorpakketten</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Elke wijziging is een nieuwe versie. Gepubliceerde versies zijn
        vergrendeld, zodat bestaande contracten hun eigen afspraken houden. Er
        zijn geen officiële pakketten of prijzen vooraf ingevuld.
      </p>
      <nav aria-label="Weergave" className="my-5 flex gap-5 text-sm">
        <Link
          className="min-h-11 content-center underline"
          aria-current={!archived ? "page" : undefined}
          href="/account/pakketten"
        >
          Actieve pakketten
        </Link>
        <Link
          className="min-h-11 content-center underline"
          aria-current={archived ? "page" : undefined}
          href="/account/pakketten?archived=yes"
        >
          Gearchiveerd
        </Link>
      </nav>
      <Card className="overflow-hidden">
        {!result.data.length ? (
          <EmptyState
            title="Geen pakketten"
            description={
              archived
                ? "Er zijn geen gearchiveerde pakketten."
                : "Voeg het eerste door de club aangeleverde pakket toe."
            }
          />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Pakketoverzicht"
          >
            <table>
              <caption className="sr-only">Sponsorpakketten en versies</caption>
              <thead>
                <tr>
                  <th scope="col">Pakket</th>
                  <th scope="col">Actuele versie</th>
                  <th scope="col">Richtprijs</th>
                  <th scope="col">Versies</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => {
                  const current = p.package_versions.find(
                    (v) => v.status === "published",
                  );
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link
                          href={`/account/pakketten/${p.id}`}
                          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        {current ? (
                          <Badge>
                            Versie {current.version_number} ·{" "}
                            {versionLabels.published}
                          </Badge>
                        ) : (
                          "Geen gepubliceerde versie"
                        )}
                      </td>
                      <td>{formatEuro(current?.list_price)}</td>
                      <td>{p.package_versions.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {!archived && (
        <Card className="mt-8 p-6">
          <h2 className="mb-5 text-lg font-semibold">Pakket toevoegen</h2>
          <PackageForm />
        </Card>
      )}
    </>
  );
}
