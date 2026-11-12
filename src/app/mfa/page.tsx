import { PublicShell } from "@/components/public-shell";
import { MfaForm } from "@/modules/auth/mfa-form";
export default function Mfa() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-8 text-3xl font-semibold">Extra verificatie</h1>
        <MfaForm />
      </section>
    </PublicShell>
  );
}
