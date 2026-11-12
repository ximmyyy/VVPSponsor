export type Workspace = "commissie" | "bestuur" | "sponsor";
export type NavItem = { label: string; icon: string; href?: string };
export const workspaces: Record<
  Workspace,
  { name: string; eyebrow: string; home: string; items: NavItem[] }
> = {
  commissie: {
    name: "Sponsorcommissie",
    eyebrow: "Cluborganisatie",
    home: "/beheer",
    items: [
      { label: "Overzicht", icon: "overview", href: "/beheer" },
      { label: "Sponsors", icon: "sponsors" },
      { label: "Pakketten", icon: "packages" },
      { label: "Contracten", icon: "contracts" },
      { label: "Sponsorrechten", icon: "rights" },
      { label: "Financiën", icon: "finance" },
      { label: "Acquisitie", icon: "acquisition" },
      { label: "Taken", icon: "tasks" },
      { label: "Evenementen", icon: "events" },
      { label: "Documenten", icon: "documents" },
      { label: "Rapportages", icon: "reports" },
      { label: "Instellingen", icon: "settings" },
    ],
  },
  bestuur: {
    name: "Clubbestuur",
    eyebrow: "Bestuursinzage",
    home: "/beheer/bestuur",
    items: [
      { label: "Overzicht", icon: "overview", href: "/beheer/bestuur" },
      { label: "Sponsors", icon: "sponsors" },
      { label: "Financiën", icon: "finance" },
      { label: "Rapportages", icon: "reports" },
    ],
  },
  sponsor: {
    name: "Sponsorportaal",
    eyebrow: "Onze samenwerking",
    home: "/portaal",
    items: [
      { label: "Overzicht", icon: "overview", href: "/portaal" },
      { label: "Bedrijf", icon: "sponsors" },
      { label: "Samenwerking", icon: "contracts" },
      { label: "Sponsorrechten", icon: "rights" },
      { label: "Documenten en facturen", icon: "documents" },
      { label: "Evenementen", icon: "events" },
      { label: "Contact", icon: "contact" },
    ],
  },
};
