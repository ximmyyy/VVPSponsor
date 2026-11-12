import { notFound } from "next/navigation";
import { companyDetails } from "@/modules/crm/data";
import { CompanyForm } from "@/modules/crm/forms";
import { Card } from "@/components/ui/card";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { company, values, client } = await companyDetails(id);
  if (company.archived_at) notFound();
  const owners = await client.rpc("crm_owners");
  if (owners.error)
    throw new Error("Verantwoordelijken konden niet geladen worden.");
  return (
    <>
      <h1 className="mb-8 text-3xl font-semibold">Bedrijf bewerken</h1>
      <Card className="p-6">
        <CompanyForm id={id} values={values} owners={owners.data} />
      </Card>
    </>
  );
}
