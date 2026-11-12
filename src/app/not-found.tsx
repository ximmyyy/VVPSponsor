import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <PublicShell>
      <div className="public-width state-page">
        <p className="eyebrow">Pagina niet gevonden</p>
        <h1 className="mt-4 text-4xl font-semibold">
          Deze pagina is niet beschikbaar.
        </h1>
        <p className="my-6 max-w-lg text-muted-foreground">
          De pagina bestaat niet of is nog niet toegankelijk. Ga terug naar de
          startpagina.
        </p>
        <Button asChild>
          <Link href="/">Naar de startpagina</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
