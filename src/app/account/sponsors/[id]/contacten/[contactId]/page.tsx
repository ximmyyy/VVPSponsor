import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { companyDetails } from "@/modules/crm/data";
import { ContactForm } from "@/modules/crm/forms";
import { Card } from "@/components/ui/card";
export default async function Contact({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>;
}) {
  const { id, contactId } = await params;
  const { client, company } = await companyDetails(id);
  if (company.archived_at || !z.uuid().safeParse(contactId).success) notFound();
  const result = await client
    .from("sponsor_contacts")
    .select("name,position,email,phone,is_primary")
    .eq("id", contactId)
    .eq("sponsor_id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (result.error) throw new Error("Contact kon niet geladen worden.");
  if (!result.data) notFound();
  const c = result.data;
  return (
    <>
      <Link
        href={`/account/sponsors/${id}`}
        className="mb-5 inline-flex min-h-11 items-center underline"
      >
        Terug naar bedrijf
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">Contactpersoon bewerken</h1>
      <Card className="p-6">
        <ContactForm
          company={id}
          id={contactId}
          values={{
            name: c.name,
            position: c.position || "",
            email: c.email || "",
            phone: c.phone || "",
            is_primary: c.is_primary,
          }}
        />
      </Card>
    </>
  );
}
