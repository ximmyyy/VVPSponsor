import { PublicShell } from "@/components/public-shell";
import { AuthForm } from "@/modules/auth/form";
export default function Login() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-4 text-3xl font-semibold">Inloggen</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Alleen voor uitgenodigde gebruikers van VV Pernis.
        </p>
        <AuthForm mode="login" />
      </section>
    </PublicShell>
  );
}
