import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
const sections = [
  ["/account/dashboard", "Dashboard"],
  ["/account/sponsors", "Sponsors"],
  ["/account/pakketten", "Pakketten"],
  ["/account/contracten", "Contracten"],
  ["/account/sponsorrechten", "Sponsorrechten"],
  ["/account/financien", "Financiën"],
] as const;
export function CrmShell({
  children,
  current = "/account/sponsors",
  boardOnly = false,
}: {
  children: ReactNode;
  current?: (typeof sections)[number][0];
  /** Bestuur ziet uitsluitend het dashboard; overige modules zijn intern. */
  boardOnly?: boolean;
}) {
  const visible = boardOnly
    ? sections.filter(([href]) => href === "/account/dashboard")
    : sections;
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
          <nav
            className="flex flex-wrap gap-x-5 text-sm"
            aria-label="Accountnavigatie"
          >
            {visible.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={current === href ? "page" : undefined}
                className={`inline-flex min-h-11 items-center ${current === href ? "font-semibold text-primary underline underline-offset-4" : ""}`}
              >
                {label}
              </Link>
            ))}
            <Link href="/account" className="inline-flex min-h-11 items-center">
              Mijn account
            </Link>
          </nav>
          <Badge>{boardOnly ? "Bestuur" : "Intern CRM"}</Badge>
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
