import Image from "next/image";
import { PublicShell } from "@/components/public-shell";
import logo from "../../../public/brand/vv-pernis-logo.png";
import { AuthForm } from "@/modules/auth/form";
export default function Login() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-md px-4 py-12">
        <div className="login-card p-8">
          <Image
            src={logo}
            alt="Clublogo VV Pernis"
            height={96}
            width={Math.round((logo.width / logo.height) * 96)}
            className="mb-6"
            priority
          />
          <h1 className="mb-4 text-3xl font-semibold">Inloggen</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Alleen voor uitgenodigde gebruikers van VV Pernis.
          </p>
          <AuthForm mode="login" />
        </div>
      </section>
    </PublicShell>
  );
}
