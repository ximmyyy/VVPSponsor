# Voortgang — VV Pernis Sponsorportaal

## Actuele stand

- Laatst bijgewerkt: **2026-11-12**.
- Fase **0 — Initialisatie**: afgerond.
- Fase **1 — Projectarchitectuur en database**: geïmplementeerd en lokaal geverifieerd.
- Volgende opdracht kan fase **2 — Design en navigatie** zijn. Die is niet gestart.
- Er werkt een technische Next.js-basis met minimale lokale database. Er is nog
  geen functionele login, gebruikersbeheer, sponsoradministratie, Storage-bucket
  of deployment. De startpagina meldt dit expliciet.
- Projectkader/besluiten: [PROJECT.md](PROJECT.md), D001–D013. Werkinstructies:
  [AGENTS.md](AGENTS.md). Installatie/start: [README.md](README.md).

## Fasestatus

| Fase | Onderdeel | Status |
| --- | --- | --- |
| 0 | Initialisatie en projectgeheugen | Afgerond |
| 1 | Projectarchitectuur en database | Lokaal afgerond |
| 2 | Design en navigatie | Niet gestart |
| 3 | Authenticatie en toegangsrechten | Niet gestart |
| 4 | Sponsor CRM | Niet gestart |
| 5 | Sponsorpakketten en contracten | Niet gestart |
| 6 | Financieel beheer | Niet gestart |
| 7 | Intern dashboard en rapportages | Niet gestart |
| 8 | Persoonlijk sponsorportaal | Niet gestart |
| 9 | Acquisitie, evenementen en notificaties | Niet gestart |
| 10 | Publieke sponsorwebsite en productievoorbereiding | Niet gestart |

## Afgerond in fase 1

- Bestaande geldige checkout `/workspace/VVPSponsor` vastgesteld. De drie nieuwe
  documentatiecommits op `origin/main` opgehaald en zonder conflicten via
  fast-forward verwerkt; er waren geen lokale gebruikerswijzigingen.
- Node 24.22.1/npm 11.9.0, exacte packageversies en `package-lock.json` vastgelegd.
  Next.js 16.4.6/React 19.3.1, strict TypeScript 5.9.3, Tailwind 4.3.5,
  Zod 4.6.7, supabase-js 2.119.0, SSR 0.12.7 en CLI 3.1.0 geïnstalleerd.
- App Router met Nederlandstalige ontwikkelstatuspagina; geen nepfunctionaliteit.
  Modulegrenzen beschreven zonder volgende fases vooruit te bouwen.
- Publieke/serverconfiguratievalidatie en getypeerde Supabase-browser-/SSR-leesclients.
  Geen adminclient; sessie-refresh en functionele autorisatie volgen in fase 3.
- Lokale Supabase-config met PostgreSQL 17, Auth en Data API. Vrije registratie en
  automatische seeding uit; geen hosted project gekoppeld.
- Basismigratie `supabase/migrations/20261112154550_foundation.sql` met
  `public.club_settings`, `public.user_profiles`, `private.user_access`, vierrollen-enum,
  singleton-/naam-/FK-constraints, timestamps, RLS en expliciete grants.
- Kleine private rolhelper met vaste lege `search_path`, alleen actuele eigen rol
  op basis van actieve DB-toekenning. Geen autorisatie op `user_metadata`.
  Geen directe gebruikersrechten op roltoekenningen, ook niet voor Super Admin.
- Toekomstige publieke tabellen krijgen geen automatische anon/authenticated-grants.
  Gebruikers kunnen alleen hun eigen weergavenaam wijzigen; Super Admin kan de
  clubnaam wijzigen en profielen lezen. Insert/delete en sleutelaanpassingen dicht.
- Lokale start-/status-/configuratiehelpers geven geen secret keys door aan logs.
  `env:local` controleert de lokale API en schrijft alleen publieke lokale waarden,
  met beperkte bestandsrechten en zonder bestaande configuratie te overschrijven.
- 117 transactionele pgTAP-controles voor de vier rollen, twee sponsoraccounts,
  inactieve/onbevoegde accounts, anon, CRUD, profielisolatie, privilegeverhoging,
  metadata-spoofing, live accountblokkade, constraints en standaardgrants.
  Bedrijfsisolatie/Storage-tests volgen met hun schema in fase 3; niet geclaimd.

## Uitgevoerde controles

| Controle | Resultaat |
| --- | --- |
| `npm ci --no-fund` | Geslaagd; installatie uit lockfile reproduceerbaar. |
| `npm run lint` | Geslaagd, nul waarschuwingen. |
| `npm run typecheck` | Geslaagd met gegenereerde database-/routetypes. |
| `npm test` | 5 geslaagd, 0 mislukt, 0 overgeslagen. |
| `npm run build` | Geslaagd; startpagina en standaard niet-gevondenpagina gegenereerd. |
| `npm run db:start` | Gezonde lokale DB/Auth/API-stack; start met bestaand volume ook gecontroleerd. |
| `npm run db:migrate` | Geslaagd; herhaling meldt geen openstaande migraties. |
| `npm run db:test` | 117 geslaagd; geen overgeslagen tests. Fixtures worden teruggedraaid. |
| Tweede lege lokale stack | Apart project `VVPSponsorReplay` in `/tmp`, afwijkende poorten: start/migratie en dezelfde 117 controles geslaagd; stack daarna gestopt, geen reset/wisactie. |
| `supabase db lint --schema public,private --level warning --fail-on warning` met telemetrie uit | Geslaagd, geen schemafouten. Dit is lokale SQL-lint, geen hosted security/performance-advisorrapport. |
| `npm run db:types` | Werkelijke types gegenereerd uit lokaal schema; herhaling werkt. |
| `npm start` en lokale HTTP-aanvraag | HTTP 200; Nederlandse titel/taal en melding over ontbrekende login gecontroleerd. |
| Directe Data API, publishable key zonder login | Beide publieke tabellen weigeren anon SELECT met HTTP 401 / SQLSTATE 42501. Private schema niet blootgesteld: HTTP 406 / PGRST106. |
| Auth API | HTTP 200; `disable_signup=true`. Geen functionele loginflow getest/gebouwd. |
| Na databasecontroles | 0 gebruikersprofielen en 0 autorisatietoekenningen achtergebleven. |
| Secretuitsluiting | `.env.local` wordt door Git genegeerd; voorbeeld bevat geen echte keys. |
| `git diff --check` | Geslaagd. |

## Opgeloste fouten en beperkingen

- De oorspronkelijke inspectie van `/workspace` vond geen bruikbare Git-root.
  De echte checkout staat één niveau lager; dit is opgelost, geen Git-initialisatie
  of nieuwe worktree uitgevoerd.
- npm kon niet naar de standaardcache in de beperkte home-map schrijven. De
  projectconfig gebruikt daarom de genegeerde `.npm-cache` in de checkout.
- CLI v3 schrijft optionele telemetrie in de home-map. De lokale scripts schakelen
  telemetrie uit via de officieel ondersteunde variabele.
- De eerste Auth-healthcheck ging door de proxy: BusyBox `wget` negeert `NO_PROXY`.
  De startwrapper corrigeert alleen de bekende loopback-probe via Docker
  `--health-cmd` en `wget -Y off`. Downloads, proxyconfiguratie, certificaat- en
  checksumverificatie blijven intact. Deze versiegebonden workaround heeft een test.
- De registry `public.ecr.aws` is niet toegestaan; de CLI gebruikte succesvol haar
  officiële GHCR-fallback. Geen netwerkbeleid verbreed of verificatie uitgeschakeld.
- De eerste pgTAP-run stopte door verkeerd geneste schrijvende CTE's in de tests.
  De test-SQL is gecorrigeerd naar top-level CTE's; daarna alle 117 tests geslaagd.
- Eerste typecheck/build liep vóór typegeneratie vast op ontbrekende databasetypes.
  Na werkelijke typegeneratie slagen beide controles.
- ESLint 10 veroorzaakte peerconflicten met Next.js-plugins. De compatibele versie
  9.39.5 is gepind en werkt, maar npm meldt dat deze lijn niet meer ondersteund is.
  Upgrade volgen zodra alle gebruikte plugins ESLint 10 ondersteunen. TypeScript
  5.9.3 is bewust gekozen als compatibele basis; dependency-upgrades apart valideren.
- Geen hosted Supabase-skills beschikbaar in deze sessie. CLI-versie en relevante
  `--help` gecontroleerd; actuele officiële Supabase-documentatie en CLI-broncode
  via de officiële GitHub-repositories geraadpleegd. De documentatiesite zelf gaf 403.
- Geen remote database, productiegegevens, externe integratie, mailaflevering,
  CI-run op GitHub of deployment aangemaakt/uitgevoerd. Geen push verricht.
- RLS-basis is lokaal bewezen; complete serverauth, machtigingen, directe API-tests
  met gebruikerssessies en Storage volgen in fase 3 vóór private modules ontsluiten.

## Gewijzigde bestanden en configuratie

- Tooling: `package.json`, lockfile, `.npmrc`, `.nvmrc`, `.gitignore`, `tsconfig.json`,
  Next-/ESLint-/PostCSS-config en `next-env.d.ts`.
- Applicatie: `src/app`, `src/lib/env`, `src/lib/supabase`, `src/modules/README.md`.
- Database: `supabase/config.toml`, basismigratie en `supabase/tests/foundation.test.sql`.
- Workflow/tests: `scripts/`, `tests/`, `.env.example` en `README.md`.
- Projectgeheugen: `PROJECT.md` en dit bestand. `AGENTS.md` blijft van toepassing.
- Cloudconfiguratie: `install_script` en `start_skill` als concept opgeslagen.
  De instructies installeren via `npm ci` en herstarten lokale diensten; opslaan
  voert ze niet uit en publiceert niets. Publicatie en herstel in een nieuwe
  cloudtaak zijn nog niet uitgevoerd/gecontroleerd.
- Alleen lokaal/genegeerd: dependencies, npm-cache, buildoutputs en `.env.local`.
  Geen geheime sleutel nodig voor deze fase. Geen automatisch eerste adminaccount.

## Open taken en volgende fase

Fase 1 heeft geen resterende functionele implementatietaak. Voor fase 2: officiële
clublogo's, kleurwaarden en gebruiksrechten aanleveren wanneer beschikbaar; zonder
bronmateriaal geen voorlopige kleuren als officiële huisstijl presenteren.
Fase 2 moet afzonderlijk worden opgedragen. Auth-/rolbeheer, uitnodigingen,
bedrijfsmachtigingen en Storage blijven fase 3. Reële sponsorgegevens en pakketten
zijn nu niet nodig. Hostingregio/budget, productiebeheer en provideraccounts volgen
pas wanneer daarvoor een expliciete opdracht bestaat.

## Logboek

| Datum | Fase | Resultaat | Besluiten |
| --- | --- | --- | --- |
| 2026-11-12 | 0 | Drie projectdocumenten met scope, model, risico's en tienfasenplan; geen applicatie- of databasewijzigingen. Toenmalige inspectie-/documentcontrole afgerond. | D001–D010 |
| 2026-11-12 | 1 | Technische appbasis, lokale basismigratie, RLS/grants, getypeerde clients, veilige configuratiehelpers, herhaalbare workflow en lokale controles. | D011–D013 |
