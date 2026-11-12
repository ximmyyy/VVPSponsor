# Voortgang — VV Pernis Sponsorportaal

## Actuele stand

- Laatst bijgewerkt: **2026-11-12**.
- Fase **0 — Initialisatie**: afgerond; alleen projectdocumentatie.
- Fase **1 — Projectarchitectuur en database**: voorbereid, **nog niet gestart**; wacht op nieuwe opdracht.
- Er bestaat nog geen applicatie, functionele login, database, migratie, Storage-bucket, werkende testset of deployment.
- De functionele scope, architectuur, voorlopige tabellen en beslissingen D001–D010 staan in [PROJECT.md](PROJECT.md). Blijvende ontwikkelinstructies staan in [AGENTS.md](AGENTS.md).

## Fasestatus

| Fase | Onderdeel | Status |
| --- | --- | --- |
| 0 | Initialisatie en projectgeheugen | Afgerond |
| 1 | Projectarchitectuur en database | Niet gestart; volgende opdracht |
| 2 | Design en navigatie | Niet gestart |
| 3 | Authenticatie en toegangsrechten | Niet gestart |
| 4 | Sponsor CRM | Niet gestart |
| 5 | Sponsorpakketten en contracten | Niet gestart |
| 6 | Financieel beheer | Niet gestart |
| 7 | Intern dashboard en rapportages | Niet gestart |
| 8 | Persoonlijk sponsorportaal | Niet gestart |
| 9 | Acquisitie, evenementen en notificaties | Niet gestart |
| 10 | Publieke sponsorwebsite en productievoorbereiding | Niet gestart |

## Afgerond in fase 0

- Werkmap en beschikbare projectbestanden geïnspecteerd. Geen bestaande applicatie, manifests, migraties, tests of instructiebestanden aangetroffen.
- `PROJECT.md` aangemaakt met volledige productomschrijving voor intern beheer, persoonlijk sponsorportaal en publieke omgeving.
- De vier rollen, voorlopige rechtenmatrix en app-/database-/Storage-autorisatie uitgewerkt.
- Stack, modulegrenzen, mappenvoorstel, designrichting, mobile-first aanpak en Capacitor-aandachtspunten vastgelegd.
- Voorlopig relationeel datamodel ontworpen, inclusief contacten versus accounts, bedrijfsmachtigingen, pakketversies, contractmomentopnamen, uitvoeringsbewijs, facturen, betalingen, credits en publicatietoestemming.
- Tien ontwikkelfases met afhankelijkheden en toetsbare acceptatiecriteria beschreven. Het volledige model wordt niet ineens in fase 1 aangemaakt.
- Environmentvariables, overige providerconfiguratie, technische risico's en later benodigde informatie vastgelegd.
- `AGENTS.md` aangemaakt met blijvende instructies voor volgende sessies.
- `PROGRESS.md` aangemaakt als apart voortgangsregister, zodat `PROJECT.md` de projectbasis blijft.

## Controles en beperkingen

| Controle | Resultaat |
| --- | --- |
| Bestandsinspectie met `rg --files` en mapinspectie | Geen bestaande applicatiecode of test-/packageconfiguratie aangetroffen in `/workspace`. |
| Bestaande `PROJECT.md`, `AGENTS.md`, `PROGRESS.md` | Niet aanwezig vóór initialisatie; geen eerdere projectcontext overschreven. |
| `git -C /workspace status --short --branch` | Mislukt: Git meldt dat dit geen repository is; aanwezige `.git` is geen bruikbare checkout. Geen commit of diff beschikbaar. |
| Technische ontwerpbronnen | Supabase- en Postgres-skills, documentatie over views en Storage en relevante changelog geraadpleegd. Geen database-instellingen of policies als getest beschouwd. |
| Documentcontrole | Geslaagd: drie leesbare UTF-8-bestanden, gebalanceerde codeblokken, geldige lokale links, onderlinge documentverwijzingen, 12 projecthoofdstukken, fasen 0–10, vier rollen en besluiten D001–D010. Scope en kernregels inhoudelijk nagelopen. |
| Lint/typecheck/build/applicatietests | Niet van toepassing: er is geen applicatie of manifest met scripts. Niet uitgevoerd en niet als geslaagd gerapporteerd. |
| Database-/RLS-/Storage-tests | Niet uitgevoerd: er is bewust geen database of Storage ingericht. Beveiliging is ontworpen, nog niet geïmplementeerd. |
| Externe wijzigingen | Geen Supabase-project/productiedatabase, migratie, account of deployment aangemaakt; geen berichten verstuurd. Alleen openbare technische documentatie gelezen. |

Afsluitende documentverificatie: **geslaagd op 2026-11-12**. Een tijdelijke Python-controle heeft structuur, lokale verwijzingen en aanwezigheid van de vereiste ontwerponderwerpen gecontroleerd. Ook bevestigd dat er geen `package.json`, `supabase`-scaffold of `.env`-bestand is aangemaakt. Dit bewijst documentconsistentie, niet de werking van nog te bouwen software.

## Bekende problemen

1. **Geen geldige Git-repository:** de projectdocumenten staan in `/workspace`, maar zijn nog niet aantoonbaar onder versiebeheer. Repositorylocatie/koppeling of initialisatie in fase 1 regelen. Geen reden om de documentatiefase te blokkeren.
2. **Geen uitvoerbare software:** alle beschreven productfuncties, tabellen en policies zijn ontwerp. Dit is de bewuste scope van fase 0.
3. **Geen technische versies gekozen:** Next.js, Node.js, packagebeheer en Supabase CLI/libraryversies worden in fase 1 gekozen en vastgelegd. Let op de recente CLI-wijzigingen; niet op verouderde commandovoorbeelden vertrouwen.

## Open taken voor fase 1 — na nieuwe opdracht

1. Herlees `PROJECT.md`, dit bestand en `AGENTS.md`; inspecteer of de werkmap inmiddels is veranderd.
2. Stel de echte repositorylocatie/versiebeheer vast en behoud eventuele nieuwe gebruikersbestanden.
3. Kies ondersteunde stabiele versies, packagebeheer en scripts; leg de keuze en lockfile vast.
4. Richt uitsluitend de modulaire technische basis en lokale Supabase-/migratieworkflow in. Geen complete sponsor- of financiële modules vooruitbouwen.
5. Werk de minimale club-/identiteits-/autorisatiebasis uit met RLS, grants en bijbehorende lokale controles; voeg domeintabellen pas toe in hun eigen fase.
6. Voeg configuratievalidatie, veilige secretuitsluiting en een `.env.example` zonder echte sleutels toe.
7. Voer beschikbare basiscontroles uit en documenteer concrete resultaten, startinstructies en eventueel benodigde lokale configuratie.

## Open beslissingen / informatie later nodig

De volledige lijst per fase staat in `PROJECT.md`, §10. Eerstvolgend relevant:

- Repository/eigenaarschap en eventueel voorkeurs-packagebeheer of hosting-/ontwikkelbudget.
- Officiële huisstijl/logo voor fase 2.
- Eerste Super Admin, rolverdeling, bestuurstoegang, uitnodigings-/MFA-beleid en mogelijke vertegenwoordiging van meerdere bedrijven voor fase 3.
- Echte pakketten/voorwaarden pas voor fase 5; financiële en fiscale werkwijze voor fase 6.
- Publicatietoestemming, bewaartermijnen, providerkeuzes, domein en productiebeheer vóór publieke oplevering.

**Nu hoeft de opdrachtgever geen secrets, accounts, sponsorgegevens of contracten aan te leveren.** Er is geen configuratie nodig om de drie documenten te gebruiken. De volgende ontwikkelfase start uitsluitend op een nieuwe opdracht.

## Logboek

| Datum | Fase | Resultaat | Ontwerpbesluiten |
| --- | --- | --- | --- |
| 2026-11-12 | 0 | Repository-inspectie en drie projectdocumenten; geen applicatie-/database-/hostingwijzigingen | D001–D010 in `PROJECT.md` |

Bij volgende fases hier een compacte regel toevoegen. Gedetailleerde validatie en open problemen hierboven actualiseren; belangrijke ontwerpwijzigingen horen met besluit-ID in `PROJECT.md`.
