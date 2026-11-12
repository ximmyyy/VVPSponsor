import { PublicShell } from "@/components/public-shell";
import { logout } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
export default function Denied() {
  return (
    <PublicShell>
      <section className="public-width state-page">
        <h1 className="text-3xl font-semibold">Geen toegang</h1>
        <p className="my-6">
          Je account heeft geen actieve toegang tot deze omgeving. Neem contact
          op met de clubbeheerder.
        </p>
        <form action={logout}>
          <Button>Uitloggen</Button>
        </form>
      </section>
    </PublicShell>
  );
}
