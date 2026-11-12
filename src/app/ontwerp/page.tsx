import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireLocalDesignPreview } from "@/lib/design-preview-server";
import { PublicShell } from "@/components/public-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
export default async function DesignPage() {
  await requireLocalDesignPreview();
  return (
    <PublicShell>
      <div className="public-width component-page">
        <Link className="back-link" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" /> Startpagina
        </Link>
        <div className="page-intro">
          <p className="eyebrow">Lokale componentenbibliotheek</p>
          <h1>Helder in iedere toestand.</h1>
          <p className="page-description">
            Ontwerpvoorbeelden voor toekomstige schermen. Onderstaande statussen
            zijn voorbeelden en voeren geen administratieve handelingen uit.
          </p>
        </div>
        <div className="component-grid">
          <Card className="p-6">
            <h2 className="mb-5 text-lg font-semibold">Kleuren & bediening</h2>
            <div className="swatches">
              <div>
                <span className="swatch swatch-blue" />
                Clubblauw <code>#045EA7</code>
              </div>
              <div>
                <span className="swatch swatch-orange" />
                Cluboranje <code>#EA751D</code>
              </div>
            </div>
            <p className="my-5 text-sm text-muted-foreground">
              De clubkleuren zijn aangeleverd. Een officieel logo is nog niet
              beschikbaar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/beheer">Naar commissieontwerp</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/portaal">Naar portaalontwerp</Link>
              </Button>
              <Button disabled>Nog niet beschikbaar</Button>
              <Badge>In voorbereiding</Badge>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="mb-5 text-lg font-semibold">
              Laadstatus — voorbeeld
            </h2>
            <LoadingState />
          </Card>
          <Card className="p-6">
            <h2 className="mb-5 text-lg font-semibold">
              Foutstatus — voorbeeld
            </h2>
            <ErrorState
              title="Voorbeeld: laden niet gelukt"
              description="In een werkend scherm krijgt de gebruiker hier een concrete melding en waar mogelijk een knop om opnieuw te proberen."
            />
          </Card>
          <Card>
            <div className="p-6 pb-0">
              <h2 className="text-lg font-semibold">Lege status — voorbeeld</h2>
            </div>
            <EmptyState
              title="Nog geen gegevens"
              description="Leg uit waarom een overzicht leeg is. Toon pas een actie wanneer de bijbehorende functie werkt."
            />
          </Card>
        </div>
        <Card className="mt-6 overflow-hidden">
          <div className="panel-heading">
            <h2>Tabelweergave — voorbeeld</h2>
            <Badge>Geen data gekoppeld</Badge>
          </div>
          <div
            className="table-scroll"
            role="region"
            aria-label="Voorbeeldtabel, horizontaal scrollbaar"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">
                Lege voorbeeldtabel voor toekomstige samenwerkingsoverzichten
              </caption>
              <thead>
                <tr>
                  <th scope="col">Onderdeel</th>
                  <th scope="col">Omschrijving</th>
                  <th scope="col">Status</th>
                  <th scope="col">Bijgewerkt</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>Nog geen gegevens beschikbaar.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}
