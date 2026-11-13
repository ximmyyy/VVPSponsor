import Link from "next/link";
import { z } from "zod";
import { requireCrm } from "@/modules/crm/access";
import { Card } from "@/components/ui/card";
import { Check, Field, StateForm } from "@/modules/contracts/forms";
import { registerPayment } from "@/modules/finance/actions";
import { todayInAmsterdam } from "@/modules/contracts/schema";
import { directionLabels, methodLabels } from "@/modules/finance/schema";

export default async function NewPayment({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const params = await searchParams;
  const sponsor =
    typeof params.sponsor === "string" &&
    z.uuid().safeParse(params.sponsor).success
      ? params.sponsor
      : "";
  const direction = params.direction === "out" ? "out" : "in";
  const companies = await client
    .from("sponsors")
    .select("id,name")
    .order("name")
    .limit(1000);
  if (companies.error) throw new Error("Bedrijven konden niet geladen worden.");
  return (
    <>
      <Link
        href="/account/financien?view=betalingen"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar betalingen
      </Link>
      <p className="eyebrow">Handmatige registratie</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold">Betaling registreren</h1>
      <Card className="p-6">
        <StateForm
          action={registerPayment}
          hidden={{}}
          submit="Betaling registreren"
          variant="default"
        >
          <div>
            <label htmlFor="pay-company" className="block text-sm font-medium">
              Bedrijf *
            </label>
            <select
              id="pay-company"
              name="company"
              required
              defaultValue={sponsor}
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
          <div className="crm-fields">
            <div>
              <label
                htmlFor="pay-direction"
                className="block text-sm font-medium"
              >
                Soort
              </label>
              <select
                id="pay-direction"
                name="direction"
                defaultValue={direction}
                className="crm-input"
              >
                {Object.entries(directionLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pay-method" className="block text-sm font-medium">
                Methode
              </label>
              <select
                id="pay-method"
                name="method"
                defaultValue="bank"
                className="crm-input"
              >
                {Object.entries(methodLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Datum"
              name="received_on"
              type="date"
              required
              defaultValue={todayInAmsterdam()}
            />
            <Field
              label="Bedrag (EUR)"
              name="amount"
              inputMode="decimal"
              required
            />
          </div>
          <Field
            label="Kenmerk (bijv. omschrijving bankafschrift)"
            name="reference"
          />
          <Check
            name="allow_duplicate"
            label="Toch registreren als er al een gelijke betaling bestaat"
          />
        </StateForm>
        <p className="mt-5 text-sm text-muted-foreground">
          Na registratie wijs je de betaling toe aan één of meer facturen. Een
          niet-toegewezen bedrag blijft zichtbaar. Een terugbetaling
          (restitutie) wijs je toe aan een creditnota.
        </p>
      </Card>
    </>
  );
}
