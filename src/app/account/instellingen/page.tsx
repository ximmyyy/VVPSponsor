import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAccess } from "@/modules/auth/context";
import { PublicShell } from "@/components/public-shell";
import { Field, StateForm } from "@/modules/contracts/forms";
import { saveClubContact } from "@/modules/portal/actions";

export default async function Settings() {
  const { client, access } = await requireAccess();
  if (access.role !== "super_admin") notFound();
  const settings = await client
    .from("club_settings")
    .select("club_name,contact_email")
    .maybeSingle();
  if (settings.error)
    throw new Error("Instellingen konden niet geladen worden.");
  return (
    <PublicShell>
      <section className="public-width state-page">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          Terug naar account
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Clubinstellingen</h1>
        <p className="my-4 max-w-xl text-sm text-muted-foreground">
          Het contactadres verschijnt in het sponsorportaal als e-mailknop naar
          de sponsorcommissie. Gebruik een gedeeld clubadres, geen privé-adres.
        </p>
        <StateForm
          action={saveClubContact}
          hidden={{}}
          submit="Opslaan"
          variant="default"
          className="max-w-xl space-y-4"
        >
          <Field
            label="Clubnaam"
            name="club_name"
            required
            defaultValue={settings.data?.club_name ?? ""}
          />
          <Field
            label="Contactadres sponsorcommissie"
            name="contact_email"
            type="email"
            defaultValue={settings.data?.contact_email ?? ""}
          />
        </StateForm>
      </section>
    </PublicShell>
  );
}
