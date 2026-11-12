import Link from "next/link";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractForm } from "@/modules/contracts/forms";

export default async function NewContract({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const raw = (await searchParams).sponsor;
  const sponsor =
    typeof raw === "string" && z.uuid().safeParse(raw).success ? raw : "";
  const companies = await client
    .from("sponsors")
    .select("id,name")
    .is("archived_at", null)
    .order("name")
    .limit(1000);
  if (companies.error) throw new Error("Bedrijven konden niet geladen worden.");
  const company = companies.data.find((c) => c.id === sponsor);
  return (
    <>
      <Link
        href="/account/contracten"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar contracten
      </Link>
      <p className="eyebrow">Nieuw concept</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold">Contract opstellen</h1>
      {!company ? (
        <Card className="p-6">
          <form method="get" className="space-y-4">
            <div>
              <label
                htmlFor="contract-company"
                className="block text-sm font-medium"
              >
                Bedrijf uit het CRM
              </label>
              <select
                id="contract-company"
                name="sponsor"
                required
                className="crm-input"
                defaultValue=""
              >
                <option value="" disabled>
                  Kies een bedrijf
                </option>
                {companies.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button>Verder</Button>
          </form>
          {!companies.data.length && (
            <p className="mt-4 text-sm text-muted-foreground">
              Er zijn nog geen actieve bedrijven. Voeg eerst een bedrijf toe in
              het CRM.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-6">
          <p className="mb-5 text-sm">
            Bedrijf: <strong>{company.name}</strong>{" "}
            <Link className="underline" href="/account/contracten/nieuw">
              Ander bedrijf kiezen
            </Link>
          </p>
          <ContractForm company={company.id} />
          <p className="mt-5 text-sm text-muted-foreground">
            Na aanmaken voeg je pakket- of maatwerkregels en sponsorrechten toe.
            Pas bij bevestigen wordt het contract vastgelegd en zichtbaar voor
            gemachtigde sponsorgebruikers.
          </p>
        </Card>
      )}
    </>
  );
}
