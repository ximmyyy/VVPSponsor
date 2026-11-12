import { requireAccess } from "@/modules/auth/context";
import { PublicShell } from "@/components/public-shell";
import { EnrollForm } from "@/modules/auth/enroll-form";
export default async function Security() {
  await requireAccess();
  return (
    <PublicShell>
      <section className="public-width state-page">
        <h1 className="mb-8 text-3xl font-semibold">
          Extra accountbeveiliging
        </h1>
        <EnrollForm />
      </section>
    </PublicShell>
  );
}
