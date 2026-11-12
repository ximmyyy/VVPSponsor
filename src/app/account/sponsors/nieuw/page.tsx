import { requireCrm } from "@/modules/crm/access";
import { CompanyForm } from "@/modules/crm/forms";
import { Card } from "@/components/ui/card";
export default async function New() {
  const { client } = await requireCrm();
  const owners = await client.rpc("crm_owners");
  if (owners.error)
    throw new Error("Verantwoordelijken konden niet geladen worden.");
  return (
    <>
      <h1 className="mb-3 text-3xl font-semibold">Bedrijf toevoegen</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Zoek eerst of dit bedrijf al bestaat, ook in het archief. De
        bedrijfsnaam is verplicht.
      </p>
      <Card className="p-6">
        <CompanyForm owners={owners.data} />
      </Card>
    </>
  );
}
