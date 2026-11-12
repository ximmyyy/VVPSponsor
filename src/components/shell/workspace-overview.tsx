import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Handshake,
  LockKeyhole,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { type Workspace } from "./navigation";
const content = {
  commissie: {
    eyebrow: "Sponsorcommissie",
    title: "Sterke relaties. Eén overzicht.",
    description:
      "De werkplek voor sponsorrelaties, afspraken en financiële opvolging. De indeling staat klaar; de administratie volgt in de volgende ontwikkelfases.",
    cards: [
      {
        title: "Sponsorrelaties",
        text: "Bedrijven en contactpersonen op één plek.",
        phase: "Fase 4",
        icon: Users,
      },
      {
        title: "Afspraken & rechten",
        text: "Inzicht in wat we met elkaar afspreken.",
        phase: "Fase 5",
        icon: Handshake,
      },
      {
        title: "Financieel overzicht",
        text: "Contracten, facturen en betalingen apart in beeld.",
        phase: "Fase 6",
        icon: Wallet,
      },
    ],
  },
  bestuur: {
    eyebrow: "Clubbestuur",
    title: "Goed inzicht. Samen vooruit.",
    description:
      "Een overzichtelijke leesomgeving voor het bestuur. Rapportages volgen zodra de bronadministratie en toegangsrechten zijn ingericht.",
    cards: [
      {
        title: "Sponsoroverzicht",
        text: "Een gedeeld beeld van de sponsorrelaties.",
        phase: "Fase 4",
        icon: Users,
      },
      {
        title: "Financiële inzage",
        text: "Relevante financiële informatie, alleen lezen.",
        phase: "Fase 6",
        icon: Wallet,
      },
      {
        title: "Rapportages",
        text: "Inzicht op basis van dezelfde brongegevens.",
        phase: "Fase 7",
        icon: ClipboardList,
      },
    ],
  },
  sponsor: {
    eyebrow: "Persoonlijk sponsorportaal",
    title: "Onze club. Jouw samenwerking.",
    description:
      "Een eigen plek voor de samenwerking met VV Pernis. Hier komen later uitsluitend de gegevens van jouw bedrijf en de documenten die met je zijn gedeeld.",
    cards: [
      {
        title: "Samenwerking",
        text: "Eigen afspraken en sponsorrechten bij elkaar.",
        phase: "Fase 8",
        icon: Handshake,
      },
      {
        title: "Documenten & facturen",
        text: "Gedeelde stukken op een veilige plek.",
        phase: "Fase 8",
        icon: ClipboardList,
      },
      {
        title: "Evenementen",
        text: "Inschrijven voor toegankelijke sponsoractiviteiten.",
        phase: "Fase 9",
        icon: CalendarDays,
      },
    ],
  },
};
export function WorkspaceOverview({ workspace }: { workspace: Workspace }) {
  const page = content[workspace];
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p className="page-description">{page.description}</p>
      </section>
      <div className="module-grid">
        {page.cards.map(({ title, text, phase, icon: Icon }) => (
          <Card key={title} className="module-card">
            <div className="module-card-top">
              <div className="module-icon">
                <Icon aria-hidden="true" />
              </div>
              <Badge>{phase}</Badge>
            </div>
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="module-status">
              <span className="status-dot" /> Nog niet beschikbaar
            </span>
          </Card>
        ))}
      </div>
      <div className="overview-grid">
        <Card className="overview-panel">
          <div className="panel-heading">
            <h2>
              {workspace === "sponsor"
                ? "Jouw overzicht"
                : "Recente ontwikkelingen"}
            </h2>
            <Badge>In voorbereiding</Badge>
          </div>
          <EmptyState
            title="Het overzicht begint hier"
            description="Er zijn nog geen gegevens gekoppeld. Na inrichting van de betreffende modules verschijnt hier de actuele informatie."
          />
        </Card>
        <Card className="next-panel">
          <p className="eyebrow">De volgende stap</p>
          <div className="next-icon">
            <LockKeyhole aria-hidden="true" />
          </div>
          <h2>Eerst een veilige toegang</h2>
          <p>
            In fase 3 volgen inloggen, uitnodigingen en de toegangsrechten voor
            iedere rol.
          </p>
          <div className="next-check">
            <Check className="size-4" aria-hidden="true" />
            <span>Vier rollen, één gegevensbron</span>
          </div>
          <div className="next-check">
            <Check className="size-4" aria-hidden="true" />
            <span>Eigen bedrijfsgegevens afgeschermd</span>
          </div>
          <span className="next-caption">
            Nog te ontwikkelen{" "}
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Card>
      </div>
    </>
  );
}
