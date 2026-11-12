import { PublicShell } from "@/components/public-shell";
import { AuthForm } from "@/modules/auth/form";
export default function Password() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-8 text-3xl font-semibold">Wachtwoord instellen</h1>
        <AuthForm mode="password" />
      </section>
    </PublicShell>
  );
}
