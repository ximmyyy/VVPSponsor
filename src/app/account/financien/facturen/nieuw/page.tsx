import Link from "next/link";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, StateForm } from "@/modules/contracts/forms";
import { createInvoice } from "@/modules/finance/actions";
import { formatEuro } from "@/modules/contracts/schema";

export default async function NewInvoice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const params = await searchParams;
  const pick = (v: unknown) =>
    typeof v === "string" && z.uuid().safeParse(v).success ? v : "";
  const sponsor = pick(params.sponsor);
  const contract = pick(params.contract);
  const companies = await client
    .from("sponsors")
    .select("id,name")
    .is("archived_at", null)
    .order("name")
    .limit(1000);
  if (companies.error) throw new Error("Bedrijven konden niet geladen worden.");
  const company = companies.data.find((c) => c.id === sponsor);
  const contracts = company
    ? await client
        .from("contract_invoicing")
        .select("contract_id,contract_value,to_invoice")
        .eq("sponsor_id", company.id)
    : { data: [], error: null };
  const headers = company
    ? await client
        .from("contracts")
        .select("id,contract_number,title,status")
        .eq("sponsor_id", company.id)
        .neq("status", "draft")
        .order("starts_on", { ascending: false })
    : { data: [], error: null };
  if (contracts.error || headers.error)
    throw new Error("Contracten konden niet geladen worden.");
  const open = new Map(contracts.data.map((c) => [c.contract_id, c]));
  return (
    <>
      <Link
        href="/account/financien"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar financiën
      </Link>
      <p className="eyebrow">Nieuw concept</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold">Factuur opstellen</h1>
      {!company ? (
        <Card className="p-6">
          <form method="get" className="space-y-4">
            <div>
              <label
                htmlFor="invoice-company"
                className="block text-sm font-medium"
              >
                Bedrijf uit het CRM
              </label>
              <select
                id="invoice-company"
                name="sponsor"
                required
                defaultValue=""
                className="crm-input"
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
        </Card>
      ) : (
        <Card className="p-6">
          <p className="mb-5 text-sm">
            Bedrijf: <strong>{company.name}</strong>{" "}
            <Link
              className="underline"
              href="/account/financien/facturen/nieuw"
            >
              Ander bedrijf kiezen
            </Link>
          </p>
          <StateForm
            action={createInvoice}
            hidden={{ company: company.id }}
            submit="Conceptfactuur maken"
            variant="default"
          >
            <div>
              <label
                htmlFor="invoice-contract"
                className="block text-sm font-medium"
              >
                Contract (optioneel)
              </label>
              <select
                id="invoice-contract"
                name="contract"
                defaultValue={contract}
                className="crm-input"
              >
                <option value="">Geen contract</option>
                {headers.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} · {c.title} — nog te factureren{" "}
                    {formatEuro(open.get(c.id)?.to_invoice)}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Kenmerk / omschrijving" name="reference" />
            <Field
              label="Vervaldatum"
              name="due_on"
              type="date"
              hint="Verplicht bij uitreiken; er is geen standaardtermijn."
            />
          </StateForm>
          <p className="mt-5 text-sm text-muted-foreground">
            Een concept heeft nog geen factuurnummer en is niet zichtbaar voor
            de sponsor. Het nummer wordt bij uitreiken gatenvrij toegekend.
          </p>
        </Card>
      )}
    </>
  );
}
