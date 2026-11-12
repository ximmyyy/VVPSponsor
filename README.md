# VV Pernis Sponsorportaal

Technische basis voor één modulaire Next.js-app met Supabase. Fases 1 en 2 zijn
geïmplementeerd: technische basis en responsieve layouts. Login, sponsoradministratie
en publieke sponsorinhoud volgen later.
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
wanneer ze worden aangeroepen. Er is geen login- of sessie-refreshflow. De SSR-client
is alleen een leesadapter; muterende sessie-adapters volgen in fase 3.

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
projecttitel en de melding dat inloggen nog niet beschikbaar is. `npm start` vereist
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
(productie), waarna 25 browsercontroles draaien. Stop een eventueel al draaiende
**eigen** Next-devserver eerst: Next gebruikt één development-lock per checkout.
De testconfig weigert bestaande servers te hergebruiken om tegen verouderde code
geteste resultaten te vermijden. Op deze cloudmachine is `/usr/bin/chromium`
beschikbaar. Elders: `npx --no-install playwright install chromium`, of stel
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` in op een eigen Chromium-installatie.

De browsercontroles dekken 360/1440 px, axe-scans, toetsenbord/menu/focus,
statusweergaven, reduced motion en productie-afscherming. Geen volledige
WCAG-audit of werkende loginflow. Testoutput/Playwright-traces blijven genegeerd.
