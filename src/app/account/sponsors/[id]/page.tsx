import Link from "next/link";
import { companyDetails } from "@/modules/crm/data";
import { ActionForm, ContactForm } from "@/modules/crm/forms";
import {
  archiveCompany,
  archiveContact,
  inviteContact,
  revokeMember,
} from "@/modules/crm/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusLabels } from "@/modules/crm/schema";
import {
  formatDate,
  statusLabels as contractStatus,
} from "@/modules/contracts/schema";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client, company, values } = await companyDetails(id);
  const [contacts, members, owners, contracts] = await Promise.all([
    client
      .from("sponsor_contacts")
      .select("id,name,position,email,phone,is_primary,archived_at")
      .eq("sponsor_id", id)
      .order("created_at"),
    client.rpc("sponsor_members", { company: id }),
    client.rpc("crm_owners"),
    client
      .from("contracts")
      .select("id,contract_number,title,status,starts_on,ends_on")
      .eq("sponsor_id", id)
      .order("starts_on", { ascending: false }),
  ]);
  if (contacts.error || members.error || owners.error || contracts.error)
    throw new Error("Contacten en machtigingen konden niet geladen worden.");
  return (
    <>
      <Link
        href="/account/sponsors"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Terug naar sponsors
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Bedrijfsdossier</p>
          <h1 className="my-2 break-words text-3xl font-semibold">
            {company.name}
          </h1>
          <Badge>
            {company.archived_at ? "Gearchiveerd" : statusLabels[values.status]}
          </Badge>
        </div>
        {!company.archived_at && (
          <Button asChild variant="outline">
            <Link href={`/account/sponsors/${id}/bewerken`}>
              Bedrijf bewerken
            </Link>
          </Button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Bedrijfsprofiel</h2>
          <dl className="crm-definition">
            {[
              ["Handelsnaam", values.trading_name],
              ["Website", values.website],
              ["Plaats", values.city],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Interne administratie</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Niet zichtbaar voor sponsoren of bestuur.
          </p>
          <dl className="crm-definition">
            {[
              [
                "Verantwoordelijke",
                owners.data.find((o) => o.user_id === values.owner_id)?.label ||
                  (values.owner_id
                    ? "Eerder toegewezen intern account"
                    : "Niet toegewezen"),
              ],
              ["Relatiestatus", statusLabels[values.status]],
              ["Betalende sponsor", values.is_paying ? "Ja" : "Nee"],
              ["KvK-nummer", values.kvk],
              ["BTW-nummer", values.vat_number],
              [
                "Adres",
                [values.street, values.postal_code, values.city]
                  .filter(Boolean)
                  .join(", "),
              ],
              ["Zakelijk e-mailadres", values.email],
              ["Telefoon", values.phone],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 font-semibold">Interne notities</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            {values.notes || "Geen interne notities."}
          </p>
        </Card>
      </div>
      <section className="mt-8" aria-labelledby="contracten">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="contracten" className="text-xl font-semibold">
            Contracten
          </h2>
          {!company.archived_at && (
            <Button asChild variant="outline">
              <Link href={`/account/contracten/nieuw?sponsor=${id}`}>
                Contract opstellen
              </Link>
            </Button>
          )}
        </div>
        <Card className="p-6">
          {contracts.data.length ? (
            <ul className="space-y-2 text-sm">
              {contracts.data.map((c) => (
                <li key={c.id}>
                  <Link
                    className="inline-flex min-h-11 items-center underline"
                    href={`/account/contracten/${c.id}`}
                  >
                    {c.contract_number} · {c.title}
                  </Link>{" "}
                  <Badge>
                    {contractStatus[c.status as keyof typeof contractStatus]}
                  </Badge>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(c.starts_on)} – {formatDate(c.ends_on)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nog geen contracten voor dit bedrijf.
            </p>
          )}
        </Card>
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Contactpersonen</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Contactpersonen zijn geen gebruikersaccounts. Een uitnodiging is een
          afzonderlijke handeling.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {contacts.data.map((contact) => (
            <Card key={contact.id} className="p-5">
              <h3 className="break-words font-semibold">
                {contact.name} {contact.is_primary && <Badge>Primair</Badge>}{" "}
                {contact.archived_at && <Badge>Gearchiveerd</Badge>}
              </h3>
              <p className="mt-2 text-sm">
                {contact.position || "Geen functie vastgelegd"}
              </p>
              <p className="my-3 break-words text-sm text-muted-foreground">
                {contact.email || "Geen e-mailadres"} ·{" "}
                {contact.phone || "Geen telefoonnummer"}
              </p>
              {!company.archived_at && (
                <div className="space-y-3">
                  {!contact.archived_at && (
                    <Link
                      className="inline-flex min-h-11 items-center text-sm underline"
                      href={`/account/sponsors/${id}/contacten/${contact.id}`}
                    >
                      Contactpersoon bewerken
                    </Link>
                  )}
                  <ActionForm
                    action={archiveContact}
                    fields={{
                      company: id,
                      id: contact.id,
                      archive: contact.archived_at ? "no" : "yes",
                    }}
                    label={
                      contact.archived_at
                        ? "Contactpersoon herstellen"
                        : "Contactpersoon archiveren"
                    }
                  />
                  {!contact.archived_at && contact.email && (
                    <ActionForm
                      action={inviteContact}
                      fields={{ company: id, contact: contact.id }}
                      label="Sponsoraccount uitnodigen"
                      confirm={`Sponsoraccount uitnodigen voor ${contact.name}? Dit geeft toegang tot dit bedrijf.`}
                    />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
        {!contacts.data.length && (
          <p className="text-sm text-muted-foreground">
            Er zijn nog geen contactpersonen.
          </p>
        )}
        {!company.archived_at && (
          <Card className="mt-5 p-6">
            <h3 className="mb-5 font-semibold">Contactpersoon toevoegen</h3>
            <ContactForm company={id} />
          </Card>
        )}
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Bedrijfsmachtigingen</h2>
        <Card className="space-y-5 p-6">
          {members.data.length ? (
            members.data.map((member) => (
              <div
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-4"
              >
                <p className="break-words text-sm">
                  {member.label}{" "}
                  <Badge role="status">
                    {member.is_active ? "Actief" : "Ingetrokken"}
                  </Badge>
                </p>
                {member.is_active && (
                  <ActionForm
                    action={revokeMember}
                    fields={{ company: id, target: member.user_id }}
                    label="Toegang intrekken"
                    confirm="Bedrijfstoegang direct intrekken?"
                  />
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Er zijn nog geen gebruikers aan dit bedrijf gekoppeld.
            </p>
          )}
        </Card>
      </section>
      <section className="mt-8">
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">
            {company.archived_at ? "Bedrijf herstellen" : "Bedrijf archiveren"}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Archiveren verwijdert niets. Bestaande machtigingen en gedeelde
            historie blijven geldig; trek toegang apart in wanneer dat nodig is.
          </p>
          <ActionForm
            action={archiveCompany}
            fields={{ id, archive: company.archived_at ? "no" : "yes" }}
            label={
              company.archived_at ? "Bedrijf herstellen" : "Bedrijf archiveren"
            }
            confirm={
              company.archived_at
                ? undefined
                : "Bedrijf archiveren? Er worden geen gegevens verwijderd."
            }
          />
        </Card>
      </section>
    </>
  );
}
