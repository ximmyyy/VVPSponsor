import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { PortalNav } from "./nav";

export function PortalShell({
  children,
  company,
  contact,
}: {
  children: ReactNode;
  company: string;
  contact: string | null;
}) {
  return (
    <div className="min-h-screen bg-background">
      <a href="#inhoud" className="skip-link">
        Direct naar inhoud
      </a>
      <header className="brand-header">
        <div className="crm-width flex flex-wrap items-center justify-between gap-3 py-4">
          <Link
            href="/account/portaal"
            aria-label="Naar het overzicht van mijn sponsorportaal"
          >
            <Brand inverse />
          </Link>
          <Badge className="max-w-full truncate">{company}</Badge>
        </div>
        <PortalNav contact={contact} />
      </header>
      <main id="inhoud" tabIndex={-1} className="crm-width py-8">
        {children}
      </main>
      <footer className="crm-width app-footer py-6 text-xs text-muted-foreground">
        VV Pernis · Persoonlijk sponsorportaal · Je ziet uitsluitend gegevens
        van je eigen bedrijf
      </footer>
    </div>
  );
}
