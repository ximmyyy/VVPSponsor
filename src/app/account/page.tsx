import Link from "next/link";
import {
  BarChart3,
  Building2,
  FileSignature,
  Handshake,
  Inbox,
  type LucideIcon,
  Package,
  Settings,
  ShieldCheck,
  Trophy,
  UserPlus,
  Wallet,
} from "lucide-react";
import { requireAccess } from "@/modules/auth/context";
import { logout } from "@/modules/auth/actions";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const roleLabels = {
  super_admin: "Super Admin",
  sponsorcommissie: "Sponsorcommissie",
  clubbestuur: "Clubbestuur",
  sponsor: "Sponsor",
} as const;
type Item = [href: string, title: string, text: string, icon: LucideIcon];

export default async function Account() {
  const { client, user, access } = await requireAccess();
  const { data: companies } =
    access.role === "sponsor"
      ? await client
          .from("sponsors")
          .select("id,name")
          .eq("id", access.sponsor_id!)
      : { data: null };
  const internal = ["super_admin", "sponsorcommissie"].includes(access.role);
  const items: Item[] = [
    ...(access.role === "sponsor"
      ? ([
          [
            "/account/portaal",
            "Naar mijn sponsorportaal",
            "Samenwerking, sponsorrechten en facturen van je bedrijf.",
            Handshake,
          ],
        ] satisfies Item[])
      : []),
    ...(internal || access.role === "clubbestuur"
      ? ([
          [
            "/account/dashboard",
            "Dashboard en rapportages",
            "Kerncijfers per seizoen en export naar Excel.",
            BarChart3,
          ],
        ] satisfies Item[])
      : []),
    ...(internal
      ? ([
          [
            "/account/sponsors",
            "Sponsors beheren",
            "Bedrijven, contactpersonen en relatiestatus.",
            Building2,
          ],
          [
            "/account/contracten",
            "Contracten en sponsorrechten",
            "Afspraken, looptijden en amendementen.",
            FileSignature,
          ],
          [
            "/account/sponsorrechten",
            "Sponsorrechten",
            "Uitvoering en deadlines van tegenprestaties.",
            Trophy,
          ],
          [
            "/account/pakketten",
            "Sponsorpakketten",
            "Pakketten en versies met standaardrechten.",
            Package,
          ],
          [
            "/account/financien",
            "Financiën",
            "Facturen, creditnota's en ontvangen betalingen.",
            Wallet,
          ],
          [
            "/account/verzoeken",
            "Verzoeken",
            "Wijzigingsverzoeken vanuit het sponsorportaal.",
            Inbox,
          ],
        ] satisfies Item[])
      : []),
    ...(access.role === "super_admin"
      ? ([
          [
            "/account/gebruikers",
            "Gebruiker uitnodigen",
            "Toegang geven aan commissie, bestuur of sponsor.",
            UserPlus,
          ],
          [
            "/account/instellingen",
            "Clubinstellingen (contactadres portaal)",
            "Het e-mailadres dat sponsors in het portaal zien.",
            Settings,
          ],
        ] satisfies Item[])
      : []),
    [
      "/account/beveiliging",
      "Extra accountbeveiliging",
      "Tweestapsverificatie met een authenticator-app.",
      ShieldCheck,
    ],
  ];
  return (
    <div className="min-h-screen bg-background">
      <a href="#inhoud" className="skip-link">
        Direct naar inhoud
      </a>
      <header className="brand-header">
        <div className="crm-width flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href="/account" aria-label="Naar mijn account">
            <Brand inverse />
          </Link>
          <Badge>{roleLabels[access.role]}</Badge>
        </div>
      </header>
      <main id="inhoud" tabIndex={-1} className="crm-width py-9">
        <section className="account-hero">
          <h1 className="text-3xl font-semibold">Je account</h1>
          <p className="mt-3 break-all">Ingelogd als {user.email}</p>
          <p className="mt-1">Rol: {roleLabels[access.role]}</p>
          {companies?.map((company) => (
            <p key={company.id} className="mt-1 break-words">
              Bedrijf: {company.name}
            </p>
          ))}
        </section>
        <nav aria-label="Onderdelen" className="account-grid mt-6">
          {items.map(([href, title, text, Icon], i) => (
            <Link
              key={href}
              href={href}
              className="account-card"
              aria-labelledby={`onderdeel-${i}`}
              aria-describedby={`onderdeel-${i}-uitleg`}
            >
              <Icon className="size-5" aria-hidden="true" />
              <div>
                <strong id={`onderdeel-${i}`}>{title}</strong>
                <span id={`onderdeel-${i}-uitleg`}>{text}</span>
              </div>
            </Link>
          ))}
        </nav>
        <form action={logout} className="mt-8">
          <Button variant="outline">Uitloggen</Button>
        </form>
      </main>
      <footer className="crm-width app-footer py-6 text-xs text-muted-foreground">
        VV Pernis · Sponsorportaal
      </footer>
    </div>
  );
}
