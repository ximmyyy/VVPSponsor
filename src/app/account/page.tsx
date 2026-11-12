import Link from "next/link";
import { requireAccess } from "@/modules/auth/context";
import { logout } from "@/modules/auth/actions";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
export default async function Account() {
  const { client, user, access } = await requireAccess();
  const { data: companies } =
    access.role === "sponsor"
      ? await client
          .from("sponsors")
          .select("id,name")
          .eq("id", access.sponsor_id!)
      : { data: null };
  return (
    <PublicShell>
      <section className="public-width state-page">
        <h1 className="text-3xl font-semibold">Je account</h1>
        <p className="my-4">Ingelogd als {user.email}</p>
        <p>
          Rol:{" "}
          {
            {
              super_admin: "Super Admin",
              sponsorcommissie: "Sponsorcommissie",
              clubbestuur: "Clubbestuur",
              sponsor: "Sponsor",
            }[access.role]
          }
        </p>
        {companies?.map((company) => (
          <p key={company.id} className="my-4">
            Bedrijf: {company.name}
          </p>
        ))}
        {["super_admin", "sponsorcommissie"].includes(access.role) && (
          <>
            <Link href="/account/sponsors" className="my-6 block underline">
              Sponsors beheren
            </Link>
            <Link href="/account/contracten" className="my-6 block underline">
              Contracten en sponsorrechten
            </Link>
            <Link href="/account/pakketten" className="my-6 block underline">
              Sponsorpakketten
            </Link>
          </>
        )}
        <p className="my-6">
          Financiën, rapportages en het persoonlijke sponsorportaal volgen in
          latere fases.
        </p>
        {access.role === "super_admin" && (
          <Link href="/account/gebruikers" className="my-6 block underline">
            Gebruiker uitnodigen
          </Link>
        )}
        <Link href="/account/beveiliging" className="my-6 block underline">
          Extra accountbeveiliging
        </Link>
        <form action={logout}>
          <Button>Uitloggen</Button>
        </form>
      </section>
    </PublicShell>
  );
}
