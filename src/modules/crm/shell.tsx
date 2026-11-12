import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
export function CrmShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <a href="#inhoud" className="skip-link">
        Direct naar inhoud
      </a>
      <header className="border-b border-border bg-white">
        <div className="crm-width flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href="/account" aria-label="Naar mijn account">
            <Brand />
          </Link>
          <nav className="flex gap-5 text-sm" aria-label="Accountnavigatie">
            <Link
              href="/account/sponsors"
              className="inline-flex min-h-11 items-center font-semibold text-primary"
            >
              Sponsors
            </Link>
            <Link href="/account" className="inline-flex min-h-11 items-center">
              Mijn account
            </Link>
          </nav>
          <Badge>Intern CRM</Badge>
        </div>
      </header>
      <main id="inhoud" tabIndex={-1} className="crm-width py-9">
        {children}
      </main>
      <footer className="crm-width border-t border-border py-6 text-xs text-muted-foreground">
        VV Pernis · Sponsorrelaties · Alleen bevoegde interne gebruikers
      </footer>
    </div>
  );
}
