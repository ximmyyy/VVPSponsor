"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";

const sections = [
  ["/account/portaal", "Overzicht"],
  ["/account/portaal/samenwerking", "Samenwerking"],
  ["/account/portaal/facturen", "Facturen"],
  ["/account/portaal/bedrijf", "Bedrijfsgegevens"],
  ["/account/portaal/collegas", "Collega's"],
] as const;

export function PortalNav({ contact }: { contact: string | null }) {
  const path = usePathname();
  // Langste overeenkomende prefix is actief; het overzicht alleen bij exacte route.
  const active = sections
    .map(([href]) => href)
    .filter(
      (href) =>
        path === href ||
        (href !== "/account/portaal" && path.startsWith(`${href}/`)),
    )
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav
      aria-label="Sponsorportaal"
      className="crm-width flex gap-1 overflow-x-auto text-sm"
    >
      {sections.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="portal-tab"
          aria-current={active === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      {contact ? (
        <a
          href={contact}
          className="portal-tab inline-flex items-center gap-1.5"
        >
          <Mail className="size-4" aria-hidden="true" /> Contact
        </a>
      ) : null}
      <Link href="/account" className="portal-tab">
        Mijn account
      </Link>
    </nav>
  );
}
