import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { Brand } from "./brand";
import { Badge } from "./ui/badge";

export function PublicShell({
  children,
  home = false,
}: {
  children: ReactNode;
  home?: boolean;
}) {
  return (
    <div className="public-shell">
      <a href="#inhoud" className="skip-link">
        Direct naar inhoud
      </a>
      <div className="public-topline">
        <div className="public-width">
          Samen bouwen aan de toekomst van onze club.
        </div>
      </div>
      <header className="public-header public-width">
        <Link href="/" aria-label="VV Pernis Sponsorportaal, startpagina">
          <Brand />
        </Link>
        <nav aria-label="Publieke navigatie" className="public-nav">
          <Link href="/" aria-current={home ? "page" : undefined}>
            Start
          </Link>
          <span aria-disabled="true">
            Sponsoren <span className="sr-only">— nog niet beschikbaar</span>
          </span>
          <span aria-disabled="true">
            Mogelijkheden{" "}
            <span className="sr-only">— nog niet beschikbaar</span>
          </span>
        </nav>
        <Badge className="public-login">
          <LockKeyhole className="size-3.5" aria-hidden="true" /> Inloggen volgt
        </Badge>
      </header>
      <main id="inhoud" tabIndex={-1} className="public-main">
        {children}
      </main>
      <footer className="public-footer public-width">
        <span>
          VV Pernis <span aria-hidden="true">/</span> Sponsorportaal
        </span>
        <span className="inline-flex items-center gap-2">
          In ontwikkeling{" "}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </span>
      </footer>
    </div>
  );
}
