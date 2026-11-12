# VV Pernis Sponsorportaal

Technische basis voor één modulaire Next.js-app met Supabase. Fases 1–8 zijn lokaal geïmplementeerd: technische basis, layouts, authenticatie,
sponsor-CRM, pakketten/contracten/sponsorrechten, financieel beheer, dashboard met
rapportages en het persoonlijke sponsorportaal. Acquisitie, evenementen en notificaties
(fase 9) staan op pauze; de publieke sponsorwebsite volgt later.
Lees bij ontwikkeling eerst [PROJECT.md](PROJECT.md), [PROGRESS.md](PROGRESS.md)
en [AGENTS.md](AGENTS.md). Gebruik de bestaande checkout; een cloudtaak is al geïsoleerd.

## Vereisten

- Node.js **24.22.1** (`.nvmrc`), npm **11.9.0**.
- Docker Engine met Linux-containers voor de lokale Supabase-stack.
- Vrije poorten 3000, 54321 (API), 54322 (PostgreSQL), 54324 (lokale testmail).
- Werkdirectory: de repositoryhoofdmap, in de cloud `/workspace/VVPSponsor`.

```sh
npm ci
npm run db:start
npm run db:migrate
npm run db:types
```

De gepinde Supabase CLI **3.1.0** gebruikt bij deze commando's standaard het lokale
doel. CLI v3 kent hier geen `--local`; gebruik geen `--remote`, `link`, `push` of
`reset` voor deze workflow. Er is geen hosted project gekoppeld. `db:start` past
migraties op een nieuwe lokale database toe; `db:migrate` past alleen nog openstaande
migraties toe. `db:stop` bewaart de lokale gegevens. Automatische seeding is uit.
De scripts schakelen optionele CLI-telemetrie uit, ook voor beperkte cloud-sandboxes.
De startwrapper corrigeert de lokale Auth-healthcheck voor BusyBox `wget`, dat
`NO_PROXY` negeert: alleen de probe naar `127.0.0.1:9999` gebruikt `-Y off`.
Docker-configuratie, registry-authenticatie en externe proxy-/TLS-controles blijven
intact. Start/status-scripts tonen geen door de CLI teruggegeven lokale secrets.

Voer `npm run env:local` uit om `.env.local` veilig aan te maken met de lokale
publishable key; dit weigert een bestaand bestand te overschrijven en controleert
het lokale doel. Handmatig kan ook: kopieer `.env.example` naar `.env.local` zonder
een bestaand bestand te overschrijven.
Vul bij handmatige configuratie `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in met de
**lokale publishable key**. Gebruik bij voorkeur `env:local`, zodat ruwe CLI-status
(die ook geheime sleutels bevat) niet wordt gelogd. `npm run db:status` toont alleen
veilige endpoints en of de publishable key aanwezig is. Gebruik nooit een
secret/service-role-key in een publieke variabele.
Er zijn geen cloudaccounts of productiesleutels nodig.

```sh
npm run dev
```

De publieke startpagina toont de basislayout en meldt dat het portaal in ontwikkeling is. Deze pagina heeft geen
databaseverbinding nodig; de getypeerde Supabase-clients valideren configuratie
wanneer ze worden aangeroepen. Login en sessieverversing zijn in fase 3 aangesloten; de gewone SSR-client gebruikt
het eigen JWT. Alleen gecontroleerde uitnodigingen gebruiken een server-only adminclient.

## Controles

```sh
npm run lint
npm run typecheck
npm test
npm run db:test
npm run build
npm start
```

Controleer de startpagina met een lokale HTTP-aanvraag: status 200, Nederlandstalige
projecttitel en de melding dat de sponsorfuncties nog in ontwikkeling zijn. `npm start` vereist
een geslaagde build. `db:test` voert pgTAP-tests uit met transactionele fictieve
accounts en draait alle fixtures terug. Er blijven geen testaccounts achter.

Na schemawijzigingen: maak een nieuwe migratie met de gepinde CLI
(`SUPABASE_TELEMETRY_DISABLED=1 npx --no-install supabase migration new <naam>`),
controleer het lokale doel, voer `db:migrate`, `db:test` en `db:types` uit en bekijk
de diff. De typegenerator schrijft atomair en bewaart bestaande types bij fouten.
Een migratie die eenmaal is gedeeld/toegepast wordt niet achteraf herschreven.

## Grenzen van de basis

- `public.club_settings`: alleen niet-geheime instellingen; actieve accounts mogen
  lezen, alleen Super Admin mag de clubnaam wijzigen. Nog geen publieke branding.
- `public.user_profiles`: actief account leest/wijzigt eigen weergavenaam;
  Super Admin mag profielen lezen. Geen insert/delete via gebruikersqueries.
- `private.user_access`: vier rollen en accountstatus; geen directe API-/tabelrechten
  voor gebruikers, ook niet voor Super Admin. De kleine policyhelper geeft alleen de
  eigen actieve rol terug en vertrouwt geen `user_metadata`.
- Elke tabel heeft RLS en expliciete grants. Accountprovisioning, rolbeheer,
  bedrijfsmachtigingen en serverautorisatie volgen in fase 3. Er is nog geen
  sponsor-/CRM-/financieel schema of Storage-bucket.
- Domeinmodules ontstaan pas in hun eigen fase. Zie `src/modules/README.md`.
- shadcn/ui-patronen, Radix en Lucide zijn in fase 2 toegevoegd. Formulier- en
  grafiekcomponenten volgen pas wanneer hun fase ze gebruikt. Clubblauw `#125B9E`
  en cluboranje `#E67522` zijn aangeleverd; officieel logo nog niet beschikbaar.

Werkelijke configuratie blijft in genegeerde `.env.local`-bestanden of veilig
omgevingsbeheer. Geen productiegegevens, remote migraties of deployment in fase 1.

## Fase 2: layouts en navigatie

Start `npm run dev` met `APP_ENV=local` in `.env.local` en gebruik een loopback-host
(`localhost` of `127.0.0.1`). Op de startpagina staan dan links naar:

- `/beheer`: commissie-indeling;
- `/beheer/bestuur`: bestuursinzage zonder beheeronderdelen;
- `/portaal`: sponsorindeling;
- `/ontwerp`: gedeelde componenten en gelabelde statusvoorbeelden.

De ontwikkelserver bindt aan 127.0.0.1. Het zijn lokale ontwerpweergaven zonder
gebruikerssessie of data. In productie worden alle bovenstaande routes en hun
subroutes vóór rendering met 404/no-store geblokkeerd, ook bij APP_ENV=local.
Dit is een tijdelijke ontwerpgrens; fase 3 moet echte autorisatie implementeren.
Alleen het overzicht is actief; toekomstige modules hebben geen link of werkende
actie. De publieke layout bevat geen gepubliceerde sponsorinformatie.

Clubnaam en kleuren staan in `src/lib/branding.ts`; semantische tokens in
`src/app/globals.css`. Het VV-monogram is een typografische ontwerpplaceholder,
geen officieel clublogo. De basiscomponenten staan in `src/components/ui` en zijn
gebaseerd op [shadcn/ui](https://github.com/shadcn-ui/ui) (MIT); mobiele focus en
Escape-bediening gebruiken Radix Dialog. De app laadt geen externe fonts of assets.

```sh
npm run test:e2e
```

Dit bouwt de app en start twee eigen testservers op 3100 (development) en 3200
(productie), waarna 32 browsercontroles draaien. Stop een eventueel al draaiende
**eigen** Next-devserver eerst: Next gebruikt één development-lock per checkout.
De testconfig weigert bestaande servers te hergebruiken om tegen verouderde code
geteste resultaten te vermijden. Op deze cloudmachine is `/usr/bin/chromium`
beschikbaar. Elders: `npx --no-install playwright install chromium`, of stel
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` in op een eigen Chromium-installatie.

De browsercontroles dekken 360/1440 px, axe-scans, toetsenbord/menu/focus,
statusweergaven, reduced motion en productie-afscherming. Geen volledige
WCAG-audit of werkende loginflow. Testoutput/Playwright-traces blijven genegeerd.

## Fase 3: authenticatie en toegang

Echte routes: `/inloggen`, `/herstellen`, `/wachtwoord`, `/mfa` en `/account`.
De oude ontwerpweergaven blijven lokaal: het zijn geen ingelogde modules.
Auth werkt alleen wanneer de lokale stack is gestart en `.env.local` correct is.
Publieke registratie staat uit. De eerste echte Super Admin is niet automatisch
geprovisioneerd en er zijn geen blijvende testaccounts/seeds aangemaakt.

Voor lokale Auth Admin-uitnodigingen kan `node scripts/local-admin-env.mjs` de
**lokale** serverbinding veilig toevoegen aan de genegeerde `.env.local`. Dit
controleert het doel en overschrijft geen bestaande binding. Herstart zo nodig de
Next-server na configuratiewijzigingen. Geen keys kopiëren naar chat, Git of logs.
Op een later hosted ontwikkelproject moet SUPABASE_SECRET_KEY veilig via de omgeving
worden gezet. Alleen servercode voor een geautoriseerde uitnodiging leest die key.

Een vertrouwde beheerder moet bij gecontroleerde ingebruikname het eerste account
via Supabase Auth uitnodigen/aanmaken en het geverifieerde gebruikers-ID een actieve
`super_admin`-toekenning in `private.user_access` geven. Doe dit alleen in een expliciet
geselecteerde ontwikkelomgeving; er is geen publiek bootstrap-endpoint. Daarna
werkt `/account/gebruikers` met de eigen geverifieerde Super Admin-sessie. Rollen,
accountstatus en bedrijfskoppeling verlopen via de begrensde `set_user_access`-RPC,
met audit. De beperkte sponsoruitnodiging voor commissieleden volgt bij CRM, fase 4.
DB-deactivatie is directe data-afscherming; provider-ban en globale sessiebeëindiging
moeten apart via vertrouwd providerbeheer worden uitgevoerd.

MFA is optioneel volgens de gekozen instelling. Gebruikers kunnen een TOTP-factor
activeren via `/account/beveiliging`. Daarna eisen login en RLS aal2. Een verloren
factor vereist vertrouwd providerbeheer; geen selfservice-reset/herstelcodes.

Private documenten krijgen expliciete metadata-vrijgave en een pad van bedrijfs-ID
plus document-ID. Sponsors mogen geen metadata of objecten uploaden/wijzigen/wissen.
Alleen interne rollen kunnen een object met passende metadata uploaden. De downloadroute
`/account/documenten/[id]` gebruikt de eigen sessie/RLS en een signed URL van 60s.
Een al uitgegeven URL blijft tot die TTL geldig; nieuwe links worden direct geweigerd
na intrekking. Inhoudsvalidatie en de complete uploadinterface volgen bij documenten.

De lokale templates gebruiken eenmalige `token_hash`-links naar `/auth/bevestigen`.
De startuphelper maakt uitsluitend deze statische bestanden leesbaar voor Kong en
behoudt de bestaande proxyconfiguratie met een uitzondering voor de interne Kong-host.
In een hosted project moeten mailtemplates/SMTP en exacte HTTPS-app-/redirect-URLs
worden ingericht. Een succesvolle lokale Mailpit-test bewijst geen productieaflevering.
Actionargumenten en binnenkomende URLs worden in development niet gelogd vanwege
wachtwoorden en callbacktokens. Ook externe logging moet die gegevens uitsluiten.

```sh
npm run db:start
npm run db:migrate
npm run db:types
npm run dev
# In een tweede terminal, met uitsluitend de lokale standaardstack en devserver:
npm run test:auth
```

`test:auth` controleert echte Auth/Data/Storage-verzoeken, browserlogin/herladen,
intrekking, uitnodiging via Mailpit, herstel, eenmalige tokens en optionele MFA.
De test weigert een ander databasedoel, gebruikt uitsluitend willekeurige UUIDs en
`.example`-accounts en ruimt uitsluitend eigen fixtures op. Niet parallel uitvoeren
met zichzelf of een dienstherstart. Stop de eigen devserver vóór `test:e2e`.
Databasebasis toen: 189 pgTAP-controles, Node-basis: 7 tests (zie fase 5 voor de actuele aantallen). De nieuwe migraties werken
ook op een lege lokale stack. Geen reset, remote migratie of deployment nodig.

## Fase 4: Sponsor CRM

Na login krijgen Super Admin en Sponsorcommissie op `/account` de link **Sponsors
beheren**. De echte routes staan onder `/account/sponsors`; de oude `/beheer`-routes
blijven lokale ontwerpprototypes. De CRM-pagina's en acties doen steeds een eigen
servercontrole, naast RLS. Bestuur en sponsoren krijgen geen intern dossier.

Het CRM bevat bedrijfsprofiel, interne administratie, verantwoordelijke, meerdere
contacten en bedrijfsmachtigingen. Naam is verplicht; overige zakelijke velden zijn
optioneel. Prospect/actief/inactief is een relatiestatus, geen account- of contractstatus.
Interne velden en contacten zijn voor sponsor/bestuur afgeschermd in aparte tabellen.
Zoeken gebruikt bedrijfsnaam; filter op status/archief, 25 resultaten per pagina.

Zoek ook in het archief vóór toevoegen. Genormaliseerde bedrijfsnaam en ingevuld
KvK-nummer (8 cijfers) zijn uniek. Omzetting van prospect naar actief gebeurt via
bewerken van hetzelfde record. Geen import, automatische merge of registervalidatie.
Archiveren bewaart alle gegevens en bestaande rechten. Toegang intrekken gebeurt
apart via de machtigingssectie. Nieuwe contacten/uitnodigingen vereisen een actief
bedrijf. Contactpersoon ≠ account: opslaan maakt nooit automatisch een login aan.

Een commissie-uitnodiging gebruikt uitsluitend een gekozen actief contact met
email, maakt alleen de Sponsorrol en dezelfde bedrijfsmachtiging aan en kan geen
bestaande interne rol of andere bedrijfsbinding overschrijven. De eerdere Super
Admin-uitnodigingen blijven beschikbaar. Voor verzending is de bestaande server-
binding nodig; lokaal `scripts/local-admin-env.mjs`, zoals beschreven bij fase 3.

```sh
npm run db:migrate
npm run db:types
npm run db:test
npm run dev
# Tweede terminal; niet parallel met test:auth of dienstherstarts:
npm run test:crm
```

De CRM-integratieflow gebruikt echte lokale JWTs, browserformulieren, Data API en
een uitnodiging naar Mailpit. Zij ruimt uitsluitend eigen UUID/.example-fixtures op.
Bestaande authregressies: `npm run test:auth`. Stop daarna de eigen Next-devserver
voor `npm run test:e2e`. Geen productiegegevens of automatische seeds nodig.

## Fase 5: pakketten, contracten en sponsorrechten

Super Admin en commissie zien in de interne navigatie **Pakketten**, **Contracten** en
**Sponsorrechten** (ook bereikbaar via `/account`). Er zijn geen officiële pakketten of
prijzen ingevuld: de commissie voert die zelf in.

1. Maak een pakket en een conceptversie met richtprijs en standaardrechten; publiceer
   die. Gepubliceerde versies zijn vergrendeld; wijzigen = nieuwe versie.
2. Stel vanuit een CRM-bedrijf een conceptcontract op, voeg pakket- en/of maatwerkregels
   en rechten toe en bevestig. Bevestigen legt regels, rechten en partijgegevens in één
   transactie vast; de sponsor ziet het contract pas daarna (via RLS; portaalscherm in fase 8).
3. Wijzigingen na bevestiging gaan via een amendement. Verlengen maakt een nieuw concept
   met voorganger; beëindigen vraagt datum en reden. Er wordt niets verwijderd.
4. Registreer uitvoering per recht, voeg bewijs toe (PDF/PNG/JPEG, max. 8 MB, inhoud
   servergecontroleerd) en deel expliciet met de sponsor.

```sh
npm run db:migrate
npm run db:types
npm run db:test          # 380 controles (fase 5)
npm test                 # 16 tests (fase 5)
npm run dev
# Tweede terminal; niet parallel met test:auth/test:crm of dienstherstarts:
npm run test:contracts
```

`test:contracts` gebruikt echte lokale JWTs, de browser, Data API en Storage, en ruimt
uitsluitend eigen `.example`/TEST-fixtures op. Elders dan deze cloudmachine kan
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` naar een eigen Chromium wijzen. Stop daarna de eigen
devserver voor `npm run test:e2e` (41 tests). Gebruik bij scripting
`supabase migration new <naam> </dev/null`, anders wacht de CLI op stdin.

## Fase 6: financieel beheer

Onder **Financiën** beheren commissie en Super Admin facturen, creditnota's en
betalingen. Prijzen zijn **inclusief BTW** (standaard 21%, per regel aanpasbaar);
nummers **F-JJJJ-NNNN** en **C-JJJJ-NNNN** worden pas bij uitreiken gatenvrij
toegekend; de vervaldatum vul je altijd zelf in.

1. Stel een factuur op (vanuit een bedrijf of contract), voeg contract- of losse regels
   toe en reik uit. Daarna is de factuur vergrendeld; corrigeer met een creditnota.
2. Registreer ontvangen geld handmatig en wijs het toe aan één of meer facturen.
   Niet-toegewezen bedragen blijven zichtbaar. Restituties registreer je als
   terugbetaling op een creditnota.
3. Upload de verzonden factuur-PDF en deel die expliciet met de sponsor.

```sh
npm run db:migrate && npm run db:types
npm run db:test          # 470 controles (fase 6)
npm test                 # 21 tests (fase 6)
npm run dev
# Tweede terminal; niet parallel met andere integratiescripts:
npm run test:finance
```

`test:finance` toetst ook echte gelijktijdige toewijzingen. Lokaal laten de
integratietests gaten in de nummertellers achter (fixtures worden opgeruimd,
tellers niet); dat speelt alleen in de lokale ontwikkeldatabase. Stop de devserver
voor `npm run test:e2e` (46 tests).

## Fase 7: dashboard en rapportages

**Dashboard** (ook voor het bestuur, via `/account` → *Dashboard en rapportages*) toont per
seizoen (1 juli – 30 juni) het budget van actieve betalende sponsors, kerncijfers,
grafieken, binnenkort aflopende contracten en prospects. Een sponsor telt als actief
wanneer je in het CRM **Betalende sponsor** aanvinkt én de relatiestatus **Actief** is.
**Exporteer naar Excel** levert een .xlsx met samenvatting, seizoenen, sponsors,
contracten, facturen en betalingen. Elke export wordt gelogd.

```sh
npm run db:migrate && npm run db:types
npm run db:test          # 513 controles (fase 7)
npm test                 # 24 tests (fase 7)
npm run dev
# Tweede terminal; niet parallel met andere integratiescripts:
npm run test:reporting
```

Stop daarna de devserver voor `npm run test:e2e` (47 tests).

## Fase 8: persoonlijk sponsorportaal

Sponsors zien na inloggen op `/account` de knop **Naar mijn sponsorportaal**
(`/account/portaal`): overzicht, samenwerking (lopend en vorige jaren), facturen,
bedrijfsgegevens met wijzigingsverzoek, collega's en een Contact-knop (e-mail).

- **Super Admin**: stel eenmalig het contactadres van de commissie in via
  `/account/instellingen`. Zonder adres toont het portaal een melding.
- **Commissie**: beoordeel wijzigingsverzoeken onder **Verzoeken** (`/account/verzoeken`).
  Goedkeuren werkt het CRM direct bij; afwijzen vraagt een toelichting.
- Collega-uitnodigingen gebruiken de bestaande server-only Auth-binding
  (`scripts/local-admin-env.mjs`, zie fase 3).

```sh
npm run db:migrate && npm run db:types
npm run db:test          # 571 controles
npm test                 # 28 tests (actueel)
npm run dev
# Tweede terminal; niet parallel met andere integratiescripts:
npm run test:portal      # volledige mobiele sponsorflow
```

Stop daarna de devserver voor `npm run test:e2e` (55 tests).

## Testgereedheid: logo, kleuren en performance

Het officiële logo staat in `public/brand/` en wordt overal via `next/image` getoond;
clubkleuren komen uit het logo (`src/lib/branding.ts`, `globals.css`).

**Lokaal testen zoals een gebruiker** (productiebuild):

```sh
npm run db:start && npm run db:migrate
npm run build
pkill -f next-server || true   # geen oude server laten draaien
npm start                      # http://localhost:3000
```

**Performance meten** (tweede terminal, productiebuild draait, niet tegelijk met andere tests):

```sh
npm run test:perf              # tijdelijke PERF-volumedata, meet, ruimt op
PERF_SPONSORS=1000 npm run test:perf
node scripts/test-perf.mjs --cleanup-only   # alleen opruimen
```

Er is nog geen gedeelde testomgeving; die vereist een hosted Supabase-project en
Vercel-preview (zie `PROGRESS.md`, open taken).

## Testomgeving

- App: https://vvp-sponsorportaal-test.vercel.app (Vercel-project `vvp-sponsorportaal-test`)
- Database: Supabase-project `vvp-sponsorportaal-test` (Frankfurt), alle migraties toegepast.
- Geen SMTP: accounts aanmaken in het Supabase-dashboard en daarna een rol toekennen
  (zie `PROGRESS.md`, sectie Testomgeving). Gebruik alleen TEST-gegevens.
