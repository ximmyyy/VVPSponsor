import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageForm, StateForm, VersionForm } from "@/modules/contracts/forms";
import { archivePackage, changeVersion } from "@/modules/contracts/actions";
import {
  formatDate,
  formatEuro,
  versionLabels,
} from "@/modules/contracts/schema";

export default async function PackageDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireCrm();
  const result = await client
    .from("sponsorship_packages")
    .select(
      "id,name,description,archived_at,package_versions(id,version_number,description,list_price,vat_rate,status,published_at,package_right_templates(id,position,description,quantity,unit,timing))",
    )
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw new Error("Pakket kon niet geladen worden.");
  if (!result.data) notFound();
  const pkg = result.data;
  const versions = [...pkg.package_versions].sort(
    (a, b) => b.version_number - a.version_number,
  );
  const hasDraft = versions.some((v) => v.status === "draft");
  return (
    <>
      <Link
        href="/account/pakketten"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar pakketten
      </Link>
      <p className="eyebrow">Pakket</p>
      <h1 className="my-2 break-words text-3xl font-semibold">{pkg.name}</h1>
      {pkg.archived_at && <Badge>Gearchiveerd</Badge>}
      <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">
        {pkg.description || "Geen omschrijving."}
      </p>

      <section className="mt-8 space-y-5" aria-labelledby="versies">
        <h2 id="versies" className="text-xl font-semibold">
          Versies
        </h2>
        {!versions.length && (
          <p className="text-sm text-muted-foreground">
            Nog geen versies. Maak hieronder een conceptversie.
          </p>
        )}
        {versions.map((v) => {
          const rights = [...v.package_right_templates].sort(
            (a, b) => a.position - b.position,
          );
          return (
            <Card key={v.id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  Versie {v.version_number}{" "}
                  <Badge role="status">
                    {versionLabels[v.status as keyof typeof versionLabels]}
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {v.published_at
                    ? `Gepubliceerd ${formatDate(v.published_at)}`
                    : "Nog niet gepubliceerd"}
                </p>
              </div>
              {v.status === "draft" && !pkg.archived_at ? (
                <div className="mt-5 space-y-6">
                  <VersionForm
                    packageId={id}
                    versionId={v.id}
                    values={{
                      description: v.description ?? "",
                      list_price: v.list_price?.toString() ?? "",
                      vat_rate: v.vat_rate?.toString() ?? "",
                      rights: rights.map((r) => ({
                        description: r.description,
                        quantity: r.quantity.toString(),
                        unit: r.unit,
                        timing: r.timing ?? "",
                      })),
                    }}
                  />
                  <StateForm
                    action={changeVersion}
                    hidden={{ id: v.id, package: id, action: "publish" }}
                    submit="Versie publiceren en vergrendelen"
                    variant="default"
                    confirm="Publiceren vergrendelt deze versie definitief en faseert de huidige gepubliceerde versie uit. Doorgaan?"
                  />
                </div>
              ) : (
                <>
                  <dl className="crm-definition mt-4">
                    <div>
                      <dt>Richtprijs</dt>
                      <dd>{formatEuro(v.list_price)}</dd>
                    </div>
                    <div>
                      <dt>BTW-tarief</dt>
                      <dd>{v.vat_rate === null ? "—" : `${v.vat_rate}%`}</dd>
                    </div>
                    <div>
                      <dt>Omschrijving</dt>
                      <dd className="whitespace-pre-wrap">
                        {v.description || "—"}
                      </dd>
                    </div>
                  </dl>
                  <h4 className="mt-5 font-semibold">Standaardrechten</h4>
                  {rights.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {rights.map((r) => (
                        <li key={r.id}>
                          {r.quantity} × {r.unit} — {r.description}
                          {r.timing ? ` (${r.timing})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Geen standaardrechten.
                    </p>
                  )}
                  {v.status === "published" && (
                    <div className="mt-5">
                      <StateForm
                        action={changeVersion}
                        hidden={{ id: v.id, package: id, action: "retire" }}
                        submit="Versie uitfaseren"
                        confirm="Uitgefaseerde versies zijn niet meer kiesbaar voor nieuwe contracten. Doorgaan?"
                      />
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })}
        {!pkg.archived_at && !hasDraft && (
          <Card className="p-6">
            <h3 className="mb-2 text-lg font-semibold">Nieuwe conceptversie</h3>
            <p className="mb-5 text-sm text-muted-foreground">
              Wijzig een gepubliceerd pakket door een nieuwe versie te maken.
              Bestaande contracten blijven aan hun eigen kopie gebonden.
            </p>
            <VersionForm packageId={id} />
          </Card>
        )}
      </section>

      {!pkg.archived_at && (
        <Card className="mt-8 p-6">
          <h2 className="mb-5 text-lg font-semibold">
            Pakketgegevens wijzigen
          </h2>
          <PackageForm
            id={id}
            values={{ name: pkg.name, description: pkg.description ?? "" }}
          />
        </Card>
      )}
      <Card className="mt-8 p-6">
        <h2 className="mb-3 text-lg font-semibold">
          {pkg.archived_at ? "Pakket herstellen" : "Pakket archiveren"}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Archiveren verwijdert niets. Bestaande contracten behouden hun regels
          en rechten.
        </p>
        <StateForm
          action={archivePackage}
          hidden={{ id, archive: pkg.archived_at ? "no" : "yes" }}
          submit={pkg.archived_at ? "Pakket herstellen" : "Pakket archiveren"}
        />
      </Card>
    </>
  );
}
