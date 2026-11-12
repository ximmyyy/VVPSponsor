# Voortgang — VV Pernis Sponsorportaal

## Actuele stand

- Laatst bijgewerkt: **2026-11-12**.
- Fase **0 — Initialisatie**: afgerond.
- Fase **1 — Projectarchitectuur en database**: geïmplementeerd en lokaal geverifieerd.
- Fase **2 — Design en navigatie**: afgerond en lokaal geverifieerd.
- Fase **3 — Authenticatie en toegangsrechten**: lokaal geïmplementeerd en geverifieerd.
- Fase **4 — Sponsor CRM**: lokaal afgerond en geverifieerd.
- Fase **5 — Sponsorpakketten en contracten**: lokaal afgerond en geverifieerd.
- Fase **6 — Financieel beheer**: lokaal afgerond en geverifieerd.
- Volgende opdracht kan fase **7 — Intern dashboard en rapportages** zijn. Die is niet gestart.
- Er werkt een technische Next.js-basis met minimale lokale database. Er werken nu
  login, gecontroleerde uitnodigingen en een private Storage-basis. Er is nog geen
  volledige sponsoradministratie of deployment. De startpagina meldt dit expliciet.
- Projectkader/besluiten: [PROJECT.md](PROJECT.md), D001–D038. Werkinstructies:
  [AGENTS.md](AGENTS.md). Installatie/start: [README.md](README.md).

## Fasestatus

| Fase | Onderdeel | Status |
| --- | --- | --- |
| 0 | Initialisatie en projectgeheugen | Afgerond |
| 1 | Projectarchitectuur en database | Lokaal afgerond |
| 2 | Design en navigatie | Lokaal afgerond |
| 3 | Authenticatie en toegangsrechten | Lokaal afgerond |
| 4 | Sponsor CRM | Lokaal afgerond |
| 5 | Sponsorpakketten en contracten | Lokaal afgerond |
| 6 | Financieel beheer | Lokaal afgerond |
| 7 | Intern dashboard en rapportages | Niet gestart |
| 8 | Persoonlijk sponsorportaal | Niet gestart |
| 9 | Acquisitie, evenementen en notificaties | Niet gestart |
| 10 | Publieke sponsorwebsite en productievoorbereiding | Niet gestart |

## Fase 6 — Financieel beheer

Opdrachtgeverkeuzes: prijzen incl. 21% BTW, nummering F-/C-JJJJ-NNNN, vervaldatum altijd
handmatig, commissie + Super Admin beheren financiën (D033–D035).

- `/account/financien`: facturen/creditnota's (filter status, bedrijf; 25 per pagina) en
  betalingen met niet-toegewezen bedrag. Links in de interne navigatie en op `/account`.
- Factuur opstellen per bedrijf, optioneel vanuit een vastgelegd contract; regels uit
  contractregels (termijnbedrag of volledige prijs) of losse regels met BTW-tarief.
  Concept bewerken/verwijderen; uitreiken met factuurdatum en verplichte vervaldatum.
- Factuurdetail: totaal incl./BTW/excl., betaald, gecrediteerd, openstaand, afgeleide
  status (openstaand/deels betaald/vervallen/voldaan), factuuradresmomentopname,
  afwikkelingshistorie met terugdraaien, volledige of lege creditnota, verrekenen van
  tegoed, restitutie-link en factuur-PDF-upload (alleen PDF, delen expliciet).
- Betaling registreren (ontvangst/terugbetaling, methode, kenmerk, dubbel-waarschuwing),
  toewijzen aan openstaande facturen of creditnota's, betaling terugdraaien met reden.
- Contractpagina toont contractwaarde, gefactureerd (na credits) en nog te factureren.

| Controle fase 6 | Resultaat |
| --- | --- |
| `npm run lint`, `npm run typecheck` | Geslaagd. |
| `npm test` | 21 geslaagd (5 nieuw: centen, factuurregel, uitreiken, betaling, afgeleide status), 0 mislukt. |
| `npm run db:test` | 470 geslaagd in vijf bestanden; `finance.test.sql` 90 nieuwe controles: afronding incl. BTW (21%/9%, regelafronding), termijnen, F/C-nummerformaat en gatenvrij na mislukte uitreiking, over-facturatie per contractregel, vervaldatum/factuurdatum, onveranderlijkheid (ook voor eigenaar), deelbetaling, onverdeeld, overtoewijzing, centen, dubbele registratie, terugdraaien, credit met automatische verrekening, max. crediteren, tegoed verrekenen, restitutie, reconciliatie, bedrijfsgrenzen, sponsor A/B/inactief/bestuur/anon, audit. |
| Lokale SQL-lint public/private, fail-on warning | Geslaagd, geen bevindingen. |
| Lege lokale stack (VVPSponsorFinanceReplay) | 15 migraties en 470 controles geslaagd; gestopt zonder volumes te wissen. Eerste poging hergebruikte het bewaarde volume van de fase-5-replay en was dus geen lege stack; daarom een nieuw project-id gebruikt. |
| `npm run test:finance` | Geslaagd: browserflow factuur → betaling → toewijzing → creditnota → verrekening, plus API-controles: twee parallelle toewijzingen van dezelfde betaling en twee parallelle betalingen op één factuur leveren telkens precies één succes en één 23514. Restitutie, contractwaarde ≠ gefactureerd ≠ ontvangen, factuur-PDF download (A 307, B 404), isolatie, terugdraaien, 360/1440 px en axe. 0 achtergebleven fixtures. |
| `npm run test:contracts`, `test:crm`, `test:auth` | Alle drie geslaagd na fase 6. |
| `npm run test:e2e` | Productiebuild geslaagd; 46 browsertests (5 nieuwe sessievereisten) geslaagd. |
| Visuele controle | Screenshot factuurdetail op 1440 px geïnspecteerd; bedragen consistent. |

### Correcties tijdens fase 6

- `add_invoice_line` las bij losse regels een niet-toegewezen record; vervolgmigratie
  `finance_line_fix` (toegepaste migratie niet herschreven).
- Variabele `amount` botste in `register_payment` met de kolomnaam; vóór toepassen hernoemd.
- `Intl` gebruikt een vaste spatie tussen € en bedrag; testselectors gebruiken `\s`.
- Na volledige toewijzing/verrekening verdwijnt het formulier; de nieuwe regel in de
  afwikkelingshistorie is de zichtbare bevestiging.

### Grenzen en open punten

- Geen PDF-generatie, verzending per e-mail, bank-/boekhoudkoppeling of export naar
  boekhoudsoftware; geen herinneringen voor vervallen facturen (fase 9).
- BTW-tarief per regel is een administratieve keuze; of alle sponsoring BTW-belast is,
  is fiscaal advies en niet door de software gecontroleerd.
- Nummering volgt het kalenderjaar van de factuurdatum; een factuur met een datum in
  een vorig jaar krijgt een nummer in die reeks. Chronologie binnen een reeks wordt niet
  afgedwongen.
- Lokale integratietests verwijderen hun fixtures maar zetten nummertellers niet terug;
  in de lokale ontwikkeldatabase ontstaan daardoor gaten. Productie verwijdert nooit
  uitgereikte facturen.
- Bestuursinzage en financiële rapportages volgen in fase 7; sponsorschermen in fase 8
  (RLS is al getest).

Bestanden: `supabase/migrations/20261112201017_finance.sql`, `…201355_finance_line_fix.sql`,
`supabase/tests/finance.test.sql`, `src/modules/finance/*`, routes onder
`src/app/account/financien`, contractpagina/-lijst, CRM-shell, accountpagina, e2e-routes,
`scripts/test-finance.mjs`, `tests/finance-schema.test.ts`, databasetypes, documentatie.

## Fase 5 — Sponsorpakketten en contracten

- Pakketbeheer (`/account/pakketten`): pakket aanmaken/wijzigen/archiveren, conceptversie
  met richtprijs, optioneel BTW-tarief en standaardrechten (React Hook Form + field array),
  publiceren (vergrendelt, vorige versie uitgefaseerd) en uitfaseren.
- Contracten (`/account/contracten`, `/nieuw`, `/[id]`): concept per CRM-bedrijf met
  validatie op looptijd/opzegdatum, pakketregels (prijs en rechten als eigen kopie) en
  maatwerkregels, extra rechten, verwijderen alleen in concept, atomair bevestigen met
  partijmomentopname, amendementen, verlenging, beëindiging. Filter op status/bedrijf,
  25 per pagina. Contractwaarde uitsluitend uit de databaseview `contract_totals`.
- Sponsorrechten: planning/verantwoordelijke/status/portaalzichtbaarheid beheren,
  uitvoering registreren (ook gedeeltelijk), controleren, delen/niet delen, ongedaan maken
  met reden. Overzicht `/account/sponsorrechten` sorteert open rechten op deadline met
  filter "mijn verantwoordelijkheid" en markeert verlopen deadlines.
- Documenten: upload van contractdocumenten en bewijs met serverinhoudscontrole, SHA-256,
  `pending` → `available` na objectcontrole, delen met sponsor/bestuur expliciet, intrekken
  direct effectief voor nieuwe downloadlinks (60 s).
- Navigatie: Sponsors · Pakketten · Contracten · Sponsorrechten in de interne shell;
  links op `/account`; contractlijst in het bedrijfsdossier.

| Controle fase 5 | Resultaat |
| --- | --- |
| `npm run lint`, `npm run typecheck` | Geslaagd. |
| `npm test` | 16 geslaagd (6 nieuw: decimalen, periode, regels/amendement, versielimiet, afgeleide fase, uploadsignaturen), 0 mislukt. |
| `npm run db:test` | 380 geslaagd in vier bestanden; `contracts.test.sql` 101 nieuwe controles: rollen/anon/inactief, twee bedrijven met meerdere gebruikers, pakketversie-onveranderlijkheid, oude contracten intact na nieuwe versie, atomair bevestigen en mislukte bevestiging zonder wijziging, triggers ook voor eigenaar, amendement + baseline, verlenging/max. één opvolger, beëindiging, bedrijfsoverschrijdende FK's, uitvoering/ongedaan maken, documentstatus en -verplaatsing, audit. |
| Lokale SQL-lint public/private, fail-on warning | Geslaagd na vervolgmigratie met expliciete jsonb-casts. Geen hosted advisorrapport (geen hosted project). |
| Lege lokale stack (VVPSponsorContractReplay, andere poorten) | Alle 13 migraties en 380 controles geslaagd; daarna gestopt, geen volumes gewist. |
| `npm run test:contracts` | Geslaagd: echte browser/Auth/Data API/Storage-flow (zie scriptmelding), inclusief sponsor A/B/bestuur/anon-isolatie, signed download, intrekking, geweigerde vervalste upload, 360/1440 px en axe zonder bevindingen. Fixtures volledig opgeruimd (0 achtergebleven gebruikers/rijen/objecten gecontroleerd). |
| `npm run test:auth` | Geslaagd na aanpassing (documenten worden nu gefinaliseerd; nieuwe audittabel opgeruimd). |
| `npm run test:crm` | 2× achter elkaar geslaagd. De eerste run direct na het starten van de devserver faalde één keer in de axe/overflowstap van het dossier; bij herhaling met logging geen overflow of axe-bevinding. Vermoedelijk timing bij eerste compilatie; als bekende flakiness genoteerd. |
| `npm run test:e2e` | Productiebuild geslaagd; 41 browsertests geslaagd (6 nieuwe sessievereisten voor fase-5-routes). |
| Visuele controle | Screenshots van contractdossier op 1440 en 360 px geïnspecteerd. |

### Correcties tijdens fase 5

- `insert_line` las bij maatwerkregels een niet-toegewezen record; ontdekt door pgTAP en
  opgelost in vervolgmigratie `contract_line_fix` (toegepaste migratie niet herschreven).
- SQL-lint meldde impliciete text→jsonb-casts; opgelost in `contract_amendment_casts`.
- `supabase migration new` wacht op stdin buiten een terminal; het aldus lege bestand
  is direct gevuld. Gebruik `</dev/null` bij scripting.
- Na publiceren/bevestigen/beëindigen verdwijnt het betreffende formulier; de nieuwe
  toestand wordt via een statusbadge (`role=status`) aangekondigd.
- Bestaande pgTAP-documentfixtures en `test:auth` expliciet op `available` / finalize
  gezet, omdat nieuwe documenten nu standaard `pending` zijn.

### Grenzen en open punten

- Geen echte pakketten, prijzen, contracten of templates ingevoerd; geen digitale
  ondertekening of PDF-generatie van contracten. Bevestigen ≠ handtekening.
- Bestuur heeft nog geen contractinzage (volgt als goedgekeurd overzicht in fase 7);
  het sponsorportaal-scherm voor contracten/rechten volgt in fase 8 (RLS is al klaar en
  getest). Geen e-mailherinneringen voor deadlines/opzegdata (fase 9).
- Uitvoeringscontrole zonder vier-ogenprincipe; besluit opdrachtgever nodig.
- Mislukte uploads blijven als `pending` metadata (onzichtbaar buiten commissie); een
  opruimproces/heruploadknop is nog niet gebouwd. Geen virusscan; alleen
  signatuurcontrole en beperkte bestandstypen.
- Contractnummerteller is per kalenderjaar (Europe/Amsterdam) en loopt ook door bij
  tests en verwijderde testfixtures; nummers zijn uniek maar niet gatenvrij.
- Test-opruiming gebruikt lokaal `session_replication_role=replica` om de historie-
  triggers voor uitsluitend eigen fixtures te omzeilen. Nooit op gedeelde databases.

Bestanden: `supabase/migrations/20261112193854_packages_contracts.sql`,
`…194623_contract_line_fix.sql`, `…194653_contract_amendment_casts.sql`,
`supabase/tests/contracts.test.sql`, `src/modules/contracts/*`, routes onder
`src/app/account/{pakketten,contracten,sponsorrechten}`, CRM-shell/dossier/account,
downloadroute, `next.config.ts` (serveractie-limiet 9 MB), databasetypes,
`scripts/test-contracts.mjs`, `tests/contracts-schema.test.ts`, e2e-routes,
aangepaste `test-auth.mjs` en `auth.test.sql`-fixtures, documentatie.

## Fase 4 — Sponsor CRM

- Echte routes `/account/sponsors`, `/nieuw`, `/[id]`, `/[id]/bewerken` en
  `/[id]/contacten/[contactId]`, beschermd op server én via Data API-RLS.
- Bedrijfsprofiel, relatiestatus, interne notities, optionele zakelijke velden en
  interne verantwoordelijke. Servercontrole valideert eigenaar als actief intern
  account. Selectie via beperkt `crm_owners`, geen sponsor-/bestuursgebruikerslijst.
- Meerdere contacten, toevoegen/bewerken/archiveren/herstellen en atomair primair
  contact wisselen. De bedrijfsbinding van een contact is onveranderlijk.
- Zoeken op bedrijfsnaam, status-/archieffilter en paginering van 25. Lege en fout-
  toestanden melden het echte queryresultaat; geen fake statistieken of demodata.
- Eén bedrijfsbron met veilige profielvelden; interne velden en contactgegevens
  afzonderlijk via RLS. Sponsoren lezen uitsluitend eigen veilige bedrijfsvelden;
  bestuur geen contacten/notities. Alle gewone queries met eigen JWT.
- Genormaliseerde bedrijfsnaam en ingevuld KvK uniek, ook in archief. Prospect naar
  actief via update van hetzelfde record. Geen automatische merge of gegevensimport.
- Beide bedrijfsdelen atomair opslaan; validatie via React Hook Form, server-Zod en
  databaseconstraints. Bij conflict geen half opgeslagen bedrijfsrecord.
- Beperkte commissie-uitnodiging voor actief contact van het gekozen bedrijf; alleen
  Sponsorrol, geen zelfmachtiging, interne roloverschrijving of bedrijfsovergang.
  Echte lokale uitnodiging via Auth/Mailpit gecontroleerd. Meerdere gemachtigden
  per bedrijf. Machtigingen apart intrekken met onmiddellijk effect op volgende query.
- Archiveren verwijdert niets en verandert bestaande rechten niet automatisch;
  dit staat expliciet bij de handeling. Geen nieuwe contacten/activaties bij archief.
- Private CRM-audit met actor, entiteit, bedrijf, operatie en tijdstip. Geen vrije
  notities dupliceren in logs. Algemene Super Admin-herkoppeling blijft werken en
  houdt geen contactreferentie van een ander bedrijf over.

| Controle fase 4 | Resultaat |
| --- | --- |
| Dependency-installatie | React Hook Form 7.92.0 en resolvers 7.0.6 exact gepind; lockfile bijgewerkt. |
| `npm run lint`, `npm run typecheck` | Geslaagd. |
| `npm test` | 10 geslaagd, 0 mislukt/overgeslagen. Nieuwe schema-/URL-/invoercontroles. |
| Lokale SQL-lint public/private met fail-on warning | Geslaagd, geen schemafouten. Geen hosted advisorrapport. |
| `npm run db:test` | 279 geslaagd in drie bestanden. RLS, privévelden, rollen/anon/inactief, FK-isolatie, contactprimair, duplicaten, rollback, eigenaar, archief, commissie- en Super Admin-machtigingen. |
| Lege lokale stack | Alle migraties en 279 tests geslaagd in VVPSponsorCrmReplay; daarna gestopt, geen reset/wisactie. |
| `npm run test:crm` | Geslaagd: echte Auth/Data API en browserflow voor commissie, aanmaken/valideren, prospectconversie op hetzelfde ID, contacten/primair contact, eigenaar, contactbewerking/archief/herstel, duplicaten en veilige velden. |
| CRM-autorisatie | Sponsor/bestuur via echte browserlogin geen intern dossier, geen notities in HTML. Directe API-queries naar notities/contacten leveren geen data; mutaties, zelfmachtiging en bedrijfsherkoppeling geweigerd. |
| Commissie-uitnodiging/intrekking | Echte uitnodiging geaccepteerd door lokale Supabase; meerdere gebruikers op hetzelfde bedrijf. Intrekken via browser geeft permanente status en direct 0 toegankelijke bedrijven met bestaand JWT. |
| Mobiel/desktop/axe | Formulier en dossier op 360/1440 px gecontroleerd, geen pagina-overflow of axe-bevindingen; screenshot dossier geïnspecteerd. Geen volledige WCAG-audit. |
| `npm run test:auth` | Bestaande echte login/herstel/uitnodiging/MFA/Data/Storage-flow geslaagd na CRM-upgrade. |
| `npm run test:e2e` | Productiebuild geslaagd, 35 browsertests geslaagd; 0 mislukt/overgeslagen. Inclusief sessievereiste voor lijst, nieuw bedrijf en dossier. |
| `npm ci --no-fund` | Geslaagd uit de bijgewerkte lockfile. Bestaande ESLint 9-supportwaarschuwing blijft bekend. |

### Uitgevoerde correcties

- Een generieke audittrigger verwees naar recordvelden die niet op alle tabellen
  bestaan. Een vervolgmigratie gebruikt uitsluitend passende UUIDs via JSONB;
  de mislukte proefinsert rolde terug. Toegepaste migraties niet herschreven.
- Aanvullende migraties regelen standaard interne bedrijfsrij, contactworkflow,
  eigenaarbescherming en compatibiliteit met bestaand Super Admin-rolbeheer.
- De vier oude negatieve INSERT/UPDATE-tests voor interne rollen waren na fase 4
  niet langer geldig. Nieuwe CRM-tests toetsen die toegestane mutaties positief;
  negatieve UPDATE-tests voor andere rollen toetsen 0 gewijzigde rijen via RLS
  in plaats van een grantfout. Overige beveiligingscontroles behouden.
- Lege/ongeldige websites veroorzaakten aanvankelijk een URL-exceptie in client-
  validatie; nu veilige parse met expliciete negatieve tests. Formulieren wachten
  op hydration en gebruiken POST zodat geen interne velden in een fallback-GET staan.
- De axe-helper vereist een expliciete browsercontext; testsetup gecorrigeerd.
  Na intrekking verdwijnt de actie; de blijvende machtigingsbadge heeft nu een
  statusrol, zodat de werkelijke nieuwe toestand ook wordt aangekondigd.

Cloud-startinstructies zijn als concept bijgewerkt voor CRM en de 10/279/35
controles. Het bestaande installatiescript blijft `npm ci` gebruiken. Dit publiceert
of deployt niets; herstel in een nieuwe cloudtaak is niet geclaimd.

### Grenzen

Voorlopige velden/statussen: geen echte bronadministratie, import of KvK-/BTW-
registercontrole. Geen automatische deduplicatie of merge van bestaande gegevens.
Geen pakketten, contracten, financiën of volledige sponsorportaalmodule gebouwd.
De echte eerste Super Admin en productie-inrichting blijven afzonderlijke
gecontroleerde ingebruikname. Geen echte sponsor-/contactdata verwerkt.
Alle tests gebruiken uitsluitend eigen UUIDs en herkenbare `.example`-fixtures;
geen blijvende seeds of andere gebruikersbestanden gewijzigd.

Bestanden: `src/modules/crm`, echte CRM-routes, accountlink/CSS, zes nieuwe
migraties, bijgewerkte databasetypes, schema-/SQL-/API-/browsertests en deze
projectdocumenten. Auth-testopruiming bijgewerkt voor de nieuwe FK's/audit.

## Fase 3 — resultaat en controles

- Login/logout, herstel, eenmalige uitnodigingsactivatie en wachtwoordinstelling met
  Supabase Auth, gevalideerde serveracties en SSR-cookies. Geen openbare registratie.
- `/account` controleert Supabase `getUser()` en actuele DB-rol/accountstatus/bedrijf.
  Gebruikers zonder actieve toegang worden geweigerd. `/account/gebruikers` is alleen
  voor actieve Super Admins en verstuurt echte uitnodigingen via Auth Admin.
- Alle gewone queries, documentdownloads en roltoekenningen gebruiken het eigen JWT.
  Een minimale server-only secretclient dient uitsluitend de gecontroleerde uitnodiging.
  Rol/status/bedrijfstoekenning is atomair, zelfmachtiging geblokkeerd, audit met
  voor-/natoestand afgeschermd. Commissie-uitnodigingen zijn nog fase 4.
- Eén actieve bedrijfsbinding per sponsoraccount; meerdere gebruikers per bedrijf.
  Alleen minimale bedrijfsidentiteiten, machtigingen en documentmetadata toegevoegd.
- Private Storage-bucket, metadata- én object-RLS, expliciete sponsor-/bestuursvrijgave,
  geen objectupdate/delete. Geautoriseerde downloadlinks maximaal 60 seconden.
- MFA op verzoek optioneel. TOTP-enrollment en challenge werken; een geactiveerde
  factor kan niet met alleen een aal1-JWT worden omzeild, ook niet via Data API.
- Gewone authreacties zijn privé/no-store. Callbackredirects blijven op dezelfde
  origin; Secure-cookies bij HTTPS. Next-developmentlogging van actionargumenten en
  binnenkomende URLs uitgeschakeld om wachtwoorden/callbacktokens niet te loggen.

| Controle fase 3 | Resultaat |
| --- | --- |
| Lint/typecheck/build | Geslaagd. |
| Lokale SQL-lint public/private | Geen schemafouten, ook met fail-on warning. |
| `npm test` | 7 geslaagd, 0 mislukt/overgeslagen. |
| Nieuwe lege lokale stack | Alle migraties en 189 tests ook geslaagd in apart project VVPSponsorAuthReplay; daarna gestopt zonder volumes te wissen. |
| `npm run db:test` | 189 geslaagd in twee pgTAP-bestanden, 0 mislukt. Vier rollen, anon, actieve/inactieve/ongebonden accounts, bedrijven/documenten/Storage, privétabellen, privilegeverhoging, machtigingsintrekking en audit. |
| `npm run test:e2e` | 32 geslaagd, 0 mislukt/overgeslagen. Bestaande responsieve layouts plus authschermen/axe en de verplichte sessie op productie-accountingang. |
| `npm run test:auth` met eigen devserver op 3000 | Geslaagd. Zes initiële Auth-accounts en een uitgenodigd testaccount; echte JWTs/Data API/Storage API. Twee bedrijven, eigen/andermans data, upload/download, signed URL, privilegeverhoging en directe intrekking gecontroleerd. |
| Browserlogin/herladen/blokkade/logout | Geslaagd met echte Supabase-cookies; ingetrokken machtiging leidt naar geen-toegang. |
| Herstel | Token geverifieerd, nieuw wachtwoord opgeslagen, hergebruik van token geweigerd. |
| Uitnodiging | Via beschermde Super Admin-serveractie naar lokale Mailpit; echte template-link geopend, wachtwoord ingesteld en eigen bedrijf zichtbaar. Geen echte e-mailadressen of externe ontvangers gebruikt. |
| Optionele MFA | Via UI enrolled/bevestigd, nieuwe login vereist challenge, juiste code werkt. Apart aal1-JWT houdt 0 zichtbare documenten, ook na verificatie in een andere sessie. |
| Downloadroute | Eigen document geeft signed redirect; gewijzigd document-ID van ander bedrijf geeft 404. |
| Testopruiming | Alleen eigen willekeurige UUID-fixtures opgeruimd; 0 achtergebleven `@auth.example`-accounts. Geen reset of bestaande gebruikersgegevens verwijderd. |
| Git/secretcontrole | `.env.local` genegeerd; serverkey alleen lokaal. Geen echt adminaccount, remote database of deployment aangemaakt. |

### Opgeloste fase-3-problemen

- Eerste migratiepoging kon Storage niet vinden omdat die dienst in fase 1 uit stond.
  De migratie werd teruggedraaid; Storage ingeschakeld en lokale diensten met behoud
  van volumes herstart, daarna migraties en typegeneratie geslaagd.
- De eerste browserasserties liepen tegen streaming-laadstatussen aan; controles
  wachten nu op zichtbare hoofdinhoud. Een selectlabel is expliciet gekoppeld.
- Herstelcookie ging aanvankelijk verloren door redirect van 127.0.0.1 naar localhost.
  Relatieve redirects lossen dit op; beide echte herstel-/activatieflows bewezen.
- Lokale templates werden niet opgehaald: interne GoTrue→Kong-verbinding moest de
  externe proxy overslaan, en de als 0600 aangemaakte HTML was niet leesbaar voor
  Kong. De Docker-wrapper behoudt bestaande proxy-uitzonderingen en voegt uitsluitend
  de lokale Kong-host toe. Startup maakt alleen de twee statische templates 0644.
  Geen TLS-/checksumverificatie uitgeschakeld. Auth- en Storage-healthchecks gebruiken
  alleen op loopback `wget -Y off`.
- Eén API-run startte te vroeg na dienstherstart en kreeg een tijdelijke uploadfout;
  na gezonde startup slaagden upload en download. Geen test afgezwakt.

### Grenzen en ingebruikname

Geen volledige CRM, dashboard-, contract-, financiële of uploadmodule gebouwd.
DB-deactivatie blokkeert gegevens direct; een volledige provider-accountban en
sessiebeëindiging gebeuren apart via vertrouwd Supabase-beheer. De app heeft
hiervoor geen algemene service-role-beheer-API.
De ontwerpen op `/beheer`, `/beheer/bestuur`, `/portaal` en `/ontwerp` blijven lokaal;
`/account` is de echte beveiligde toegang. Bestuur blijft bij minimale leesrechten.
MFA-herstel na verlies van een authenticator vereist een vertrouwde providerbeheerder;
geen selfservice-reset of herstelcodes. Bestandsinhoudsscan hoort bij de latere
uploadworkflow; hier uitsluitend de private autorisatiebasis.

Het eerste echte Super Admin-account is nog niet aangemaakt. Het beoogde adres is
in de sessie ontvangen en wordt niet in deze publieke projectdocumentatie opgenomen.
Productionele SMTP, exacte HTTPS-URLs, redirects, server-secret en beheerprocedure
moeten vóór ingebruikname in de provider/omgeving worden ingericht. Fase 3 is lokaal
gevalideerd; dit is geen toestemming of bewijs van productie-inrichting.

Cloud-startinstructies zijn als concept bijgewerkt voor Auth/Storage, veilige lokale
serverbinding, 7/189/32 controles en de echte integratieflow. Opslaan heeft niets
gepubliceerd; herstel in een nieuwe cloudtaak is niet geclaimd.

Er zijn drie nieuwe migraties:
`20261112163057_auth_foundation.sql`, `20261112163614_audit_access_changes.sql`,
`20261112163746_mfa_enforcement.sql`; daarnaast config/templates, authmodule,
account-/authroutes, SSR/proxy, lokale helpers en echte integratiecontroles.

## Afgerond in fase 2

- Clubkleuren ontvangen: blauw `#125B9E`, oranje `#E67522`. Eén brandingconfiguratie
  en semantische tokens voor kleur, tekst, oppervlak, randen, focus en zijbalk.
  Geen officieel logo ontvangen; het typografische VV-merk is een ontwerpplaceholder.
- Publieke basislayout op `/` met projectstatus, drie toekomstige omgevingen en
  expliciete melding dat inloggen/sponsorfuncties nog niet beschikbaar zijn.
  Geen sponsorprofielen, pakketten, prijzen, contracten of formulieren verzonnen.
- Lokale commissie-indeling `/beheer`, bestuursinzage `/beheer/bestuur` en
  sponsorindeling `/portaal`. Gedeelde responsieve shell, zijbalk, breadcrumbs,
  contextspecifieke navigatie en mobiele Radix/shadcn Sheet met focusbeheer.
  Geen fake ingelogd account, statistieken of bedrijfsgegevens.
- Server-side ontwerpgrens in `src/proxy.ts` plus layoutcontroles: development,
  APP_ENV=local, loopback-host, geen Vercel-context. Productie retourneert 404/no-store,
  ook met APP_ENV=local. `npm run dev` bindt alleen aan 127.0.0.1.
  Dit verleent geen gebruikersrechten en vervangt de autorisatie uit fase 3 niet.
- Alleen het werkende overzicht krijgt een actieve navigatielink. Toekomstige
  modules zijn niet aanklikbaar en als 'Later' gemarkeerd. Bestuur heeft geen
  beheeronderdelen; er is geen rolwisselaar of rolbeheer.
- Gedeelde Button, Card, Badge, Skeleton en Sheet volgens shadcn/ui-patronen;
  Button/Sheet op basis van de officiële MIT-bronnen. Lucide-iconen, native
  semantiek, 44px-bediening, zichtbare focus, skiplinks en reduced motion.
- `/ontwerp`: alleen lokale componentenbibliotheek met gelabelde lege-, fout- en
  laadvoorbeelden en een horizontaal scrollbare voorbeeldtabel zonder records.
  Globale Next.js-loading/error/not-found-fallbacks aangesloten. Error-adapter
  gebruikt `retry` volgens de documentatie van de geïnstalleerde Next.js-versie.
- Playwright 1.65.0 en axe 4.14.0, aparte lokale development- en productie-servers.
  De cloud gebruikt geïnstalleerde Chromium; andere machines kunnen Playwrights
  Chromium installeren of PLAYWRIGHT_CHROMIUM_EXECUTABLE instellen.

## Controles fase 2

| Controle | Resultaat |
| --- | --- |
| Dependency-installatie en `npm ci --no-fund` | Geslaagd met exacte versies en bijgewerkte lockfile. Bestaande ESLint-supportwaarschuwing blijft een bekende toolingbeperking. |
| `npm run lint` | Geslaagd; nul fouten/waarschuwingen. |
| `npm run typecheck` | Geslaagd. |
| `npm test` | 6 geslaagd, 0 mislukt/overgeslagen; waaronder positieve en negatieve gevallen voor de lokale ontwerpgrens. |
| `npm run build` | Geslaagd; publieke en lokale routes plus serverproxy compileren. |
| `npx --no-install playwright test` na de build | **25 geslaagd, 0 mislukt, 0 overgeslagen**. `npm run test:e2e` combineert build en browserrunner. |
| Responsiviteit en browserfouten | `/`, `/beheer`, `/beheer/bestuur`, `/portaal`, `/ontwerp` getest op 360×800 en 1440×1000; geen horizontale pagina-overflow of JavaScript-paginafouten. |
| axe WCAG 2 A/AA, 2.1 AA en 2.2 AA-regels | Geen bevindingen op de tien bovenstaande pagina/viewportcombinaties en het geopende mobiele menu. Dit bewijst geen volledige WCAG-conformiteit. |
| Toetsenbord | Skiplink als eerste tabstop; focus naar hoofdinhoud. Mobiele dialoog met Enter openen, focus binnen dialoog, Escape sluiten, focus terug naar trigger; navigatie sluit menu. |
| Componentstatussen | Laadstatus, foutalert, lege toestand, disabled bediening en focusbare/scrollbare tabel aangetroffen. Animatie uit bij reduced motion. |
| Productie-afscherming | `/beheer`, `/beheer/bestuur`, `/portaal`, `/ontwerp` en onbekende subroutes geven 404/no-store. Geen lokale ontwerplinks op publieke productiepagina, ondanks APP_ENV=local. |
| Niet-lokale host | Developmentverzoek met Host=example.com krijgt 404; geen interne shell. |
| Publieke 404 | Niet-gevondenpagina met werkende teruglink naar startpagina. |
| Visuele inspectie | Desktop commissie/publieke layout, mobiel sponsoroverzicht en geopend menu via screenshots geïnspecteerd. |
| Database | Geen schema-, migratie-, grant-, RLS- of Storagewijzigingen in fase 2. De 117 databasecontroles uit fase 1 zijn historisch bewijs; niet opnieuw als fase-2-run opgevoerd. |
| `git diff --check` | Geslaagd. |

De eerste browserrun had twee foutselecties: Next.js voegt zelf een tweede
`role=alert` toe. De controle is beperkt tot de foutstatus binnen `main`; de
gewenste melding is niet verwijderd of afgezwakt. Daarna alle 25 tests geslaagd.
Een herstart botste eenmalig met de eigen visuele-reviewserver; die is gestopt en
dezelfde browserrunner is opnieuw uitgevoerd. Next dev heeft automatisch een
Next.js-instructieblok aan AGENTS.md toegevoegd; bestaand projectbeleid behouden.
De relevante meegeleverde guides voor proxy, loading, error, not-found en
ontwikkelindicatoren zijn geraadpleegd. Het echte foutboundary-/loginproces is
niet als end-to-endflow getest; fout-UI en frameworkadapter zijn voorbereid.

Cloud-startinstructies (`start_skill`) zijn bijgewerkt en als concept opgeslagen.
Het bestaande installatiescript blijft `npm ci` gebruiken. Dit heeft niets
gepubliceerd of gedeployd; herstel in een nieuwe cloudtaak is niet getest.

## Bestanden fase 2

- `src/components/`: branding, publieke shell, gedeelde statussen, UI-componenten,
  navigatie, workspaceshell en drie contextspecifieke overzichtsindelingen.
- `src/app/`: vernieuwde startpagina/layout/CSS, beheer/bestuur/portaal/ontwerp,
  loading/error/not-found. `src/lib/branding.ts`, lokale ontwerpguards, `utils.ts`
  en `src/proxy.ts` ondersteunen de layouts; geen auth- of datalaag toegevoegd.
- Het gegenereerde `next-env.d.ts` wordt volgens de meegeleverde Next.js-guide
  niet meer gevolgd in Git; typegen/dev/build maken het opnieuw aan.
- Tooling: `components.json`, `playwright.config.ts`, `tests/e2e/`,
  `tests/design-preview.test.ts`, package/lockfile, gitignore en Next-config.
- Projectgeheugen: PROJECT.md, dit bestand en README.md bijgewerkt. Het door Next
  gegenereerde instructieblok in AGENTS.md is behouden.

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

## Uitgevoerde controles fase 1 (historisch)

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

Fase 6 is lokaal geïmplementeerd. Echte pakketten, contracten, facturen en betalingen
voert de commissie zelf in; die gegevens worden niet verzonnen. Fase 7 (Intern
dashboard en rapportages) vereist een nieuwe opdracht en vooraf: gewenste KPI's,
definitie 'actieve sponsor', seizoen/boekjaar voor periodes, welke cijfers het bestuur
mag zien en gewenste exportformaten (CSV/Excel). Echte CRM-import blijft een aparte opdracht met proefvalidatie.
Officieel logo, eerste echte Super Admin en productieconfiguratie blijven open;
geen waarden of echte persoonsgegevens in Git opgeslagen.

## Logboek

| Datum | Fase | Resultaat | Besluiten |
| --- | --- | --- | --- |
| 2026-11-12 | 0 | Drie projectdocumenten met scope, model, risico's en tienfasenplan; geen applicatie- of databasewijzigingen. Toenmalige inspectie-/documentcontrole afgerond. | D001–D010 |
| 2026-11-12 | 1 | Technische appbasis, lokale basismigratie, RLS/grants, getypeerde clients, veilige configuratiehelpers, herhaalbare workflow en lokale controles. | D011–D013 |
| 2026-11-12 | 2 | Clubkleuren, publieke/interne/portaallayouts, lokale ontwerpgrens, toegankelijke componenten en 25 geslaagde browsercontroles. | D014–D016 |
| 2026-11-12 | 3 | Auth, live autorisatie, bedrijfsmachtigingen, private Storage, uitnodiging, herstel en optionele MFA lokaal geverifieerd. | D017–D021 |
| 2026-11-12 | 4 | CRM, meerdere contacten, interne privacy, prospectconversie, filters/archief en beperkte commissie-uitnodigingen. | D022–D026 |
| 2026-11-12 | 5 | Pakketversies, contracten met regels/rechten, atomaire bevestiging, amendementen, verlenging/beëindiging, uitvoering met bewijs en private contractdocumenten; 380 DB-controles, 41 browsertests en echte contractflow. | D027–D032 |
| 2026-11-12 | 6 | Facturen incl. 21% BTW, gatenvrije F/C-nummering, termijnen uit contracten, creditnota's met verrekening, handmatige betalingen met vergrendelde toewijzing, restitutie en factuur-PDF; 470 DB-controles, 46 browsertests en echte financiële flow. | D033–D038 |
