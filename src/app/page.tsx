import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Handshake,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import { localDesignPreviewEnabled } from "@/lib/design-preview-server";

export default async function Home() {
  const preview = await localDesignPreviewEnabled();
  return (
    <PublicShell home>
      <section className="public-hero public-width">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="orange-line" /> VV Pernis · Sponsorportaal
          </p>
          <h1>
            Samen maken we
            <br />
            <span>meer mogelijk.</span>
          </h1>
          <p className="hero-description">
            Een eigen plek voor de mensen en bedrijven die onze club
            vooruithelpen. We bouwen aan een helder overzicht van relaties,
            afspraken en samenwerking.
          </p>
          <Badge className="hero-status">
            <span className="status-dot" /> Het portaal is in ontwikkeling
          </Badge>
          <a className="hero-anchor" href="#vooruitblik">
            Een blik vooruit <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="pitch-lines">
            <div className="pitch-circle" />
            <div className="pitch-center" />
          </div>
          <div className="visual-top">
            STERKER DOOR
            <br />
            SAMENWERKING<span>VV PERNIS</span>
          </div>
          <div className="visual-card">
            <Handshake />
            <div>
              Verbonden met de club<span>Vandaag én morgen</span>
            </div>
            <span className="visual-check">
              <Check />
            </span>
          </div>
          <span className="visual-coordinate">
            RELATIES / AFSPRAKEN / INZICHT
          </span>
        </div>
      </section>
      <section id="vooruitblik" className="public-features public-width">
        <div className="section-heading">
          <div>
            <p className="eyebrow">De basis voor samenwerking</p>
            <h2>Alles krijgt een eigen plek.</h2>
          </div>
          <p>
            Drie omgevingen. Eén gedeelde basis.
            <br />
            Stapsgewijs en zorgvuldig opgebouwd.
          </p>
        </div>
        <div className="feature-grid">
          {[
            {
              number: "01",
              title: "Voor de club",
              text: "Een centrale werkplek voor de sponsorcommissie en overzichtelijke inzage voor het bestuur.",
              Icon: Users,
            },
            {
              number: "02",
              title: "Voor sponsoren",
              text: "Een persoonlijk portaal voor eigen afspraken, gedeelde documenten en de samenwerking met de club.",
              Icon: Handshake,
            },
            {
              number: "03",
              title: "Voor iedereen",
              text: "Een publieke omgeving voor uitsluitend goedgekeurde sponsorinformatie en mogelijkheden.",
              Icon: ShieldCheck,
            },
          ].map(({ number, title, text, Icon }) => (
            <article className="feature" key={number}>
              <div className="feature-top">
                <span>{number}</span>
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-width availability">
        <div className="availability-icon">
          <LockKeyhole aria-hidden="true" />
        </div>
        <div>
          <h2>We zijn nog aan het bouwen</h2>
          <p>
            Inloggen en sponsorfuncties zijn nog niet beschikbaar. Er worden nog
            geen sponsorprofielen of sponsorpakketten gepubliceerd.
          </p>
        </div>
        <Badge>Stap voor stap</Badge>
      </section>
      {preview && (
        <section className="public-width preview-entry">
          <p className="eyebrow">Alleen lokale ontwikkeling</p>
          <h2>Bekijk de ontwerpweergaven</h2>
          <p>
            Deze indelingen bevatten geen bedrijfsgegevens en geven geen
            gebruikersrechten.
          </p>
          <div>
            {[
              { href: "/beheer", label: "Sponsorcommissie" },
              { href: "/beheer/bestuur", label: "Clubbestuur" },
              { href: "/portaal", label: "Sponsorportaal" },
              { href: "/ontwerp", label: "Componenten" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                {label}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
