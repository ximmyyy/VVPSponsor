import { requirePortal } from "@/modules/portal/access";
import { Badge } from "@/components/ui/badge";
import { Field, StateForm } from "@/modules/contracts/forms";
import { inviteColleague, revokeColleague } from "@/modules/portal/actions";

export default async function Colleagues() {
  const { client } = await requirePortal();
  const members = await client.rpc("portal_members");
  if (members.error) throw new Error("Collega's konden niet geladen worden.");
  return (
    <>
      <p className="eyebrow">Toegang</p>
      <h1 className="mt-2 text-3xl font-semibold">Collega&apos;s</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Geef collega&apos;s toegang tot het portaal van jullie bedrijf. Zij zien
        dezelfde gegevens als jij.
      </p>
      <div className="dash-two mt-6">
        <section className="dash-panel" aria-labelledby="gemachtigden">
          <h2 id="gemachtigden">Gebruikers met toegang</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {members.data.map((m) => (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0 break-all">
                  {m.email} {m.is_self && <Badge>Jij</Badge>}{" "}
                  <Badge role="status">
                    {m.is_active ? "Actief" : "Ingetrokken"}
                  </Badge>
                </span>
                {m.is_active && !m.is_self && (
                  <StateForm
                    action={revokeColleague}
                    hidden={{ id: m.user_id }}
                    submit="Toegang intrekken"
                    confirm={`Toegang van ${m.email} intrekken?`}
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Opnieuw toegang geven aan een ingetrokken account gaat via de
            sponsorcommissie.
          </p>
        </section>
        <section className="dash-panel" aria-labelledby="uitnodigen">
          <h2 id="uitnodigen">Collega uitnodigen</h2>
          <StateForm
            action={inviteColleague}
            hidden={{}}
            submit="Uitnodiging versturen"
            variant="default"
            className="mt-4 space-y-4"
          >
            <Field
              label="Zakelijk e-mailadres"
              name="email"
              type="email"
              required
            />
          </StateForm>
          <p className="mt-3 text-xs text-muted-foreground">
            Je collega ontvangt een e-mail om een wachtwoord in te stellen en
            krijgt alleen toegang tot jullie bedrijf.
          </p>
        </section>
      </div>
    </>
  );
}
