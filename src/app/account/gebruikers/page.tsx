import { notFound } from "next/navigation";
import { requireAccess } from "@/modules/auth/context";
import { InviteForm } from "@/modules/auth/invite-form";
import { PublicShell } from "@/components/public-shell";
export default async function Users() {
  const { access, client } = await requireAccess();
  if (access.role !== "super_admin") notFound();
  const result = await client.from("sponsors").select("id,name");
  if (result.error) throw new Error("Bedrijven konden niet geladen worden.");
  return (
    <PublicShell>
      <section className="public-width state-page">
        <h1 className="mb-8 text-3xl font-semibold">Gebruiker uitnodigen</h1>
        <InviteForm companies={result.data} />
      </section>
    </PublicShell>
  );
}
