# Blijvende ontwikkelinstructies — VV Pernis Sponsorportaal

Dit bestand (`AGENTS.md`) geldt voor de hele projectmap.

## Voor iedere opdracht

1. Lees eerst `PROJECT.md`, daarna `PROGRESS.md`, deze instructies en eventuele instructies in de relevante submappen.
2. Inspecteer bestaande code, migraties, configuratie, tests en Git-status vóór wijzigingen. Behoud bestaande functionaliteit en gebruikerswijzigingen. Neem niet aan dat een beschreven ontwerp al geïmplementeerd is.
3. Bepaal welke fase expliciet is opgedragen en controleer afhankelijkheden. Ontwikkel **alleen de gevraagde fase**. Het tienfasenplan is geen toestemming om vooruit te bouwen. Vraag alleen gerichte verduidelijking als een noodzakelijke beslissing niet uit de context volgt.

## Architectuur en gegevens

- Volg de stack en modulegrenzen uit `PROJECT.md`: Next.js/TypeScript, Tailwind, shadcn/ui, Lucide, Supabase PostgreSQL/Auth/Storage/RLS, React Hook Form, Zod, Recharts en later Vercel.
- Eén bron voor bedrijven, afspraken en geldstromen. Contactpersoon ≠ gebruikersaccount. Pakketversies en contractmomentopnamen beschermen historie; contractwaarde, facturen en ontvangen betalingen blijven afzonderlijk.
- Alle databasewijzigingen via reviewbare migraties, inclusief grants, constraints, functies, RLS en Storage-policies. Controleer bestaand schema en doelomgeving. Geen destructieve databaseoperaties zonder toestemming; nooit stilzwijgend resetten, data wissen of een remote database wijzigen.
- Raadpleeg bij Supabase-implementatie de relevante skills en actuele docs; verifieer CLI-versie en `--help`. Pin dependencies/CLI en commit de gekozen lockfile zodra er een werkende repository is.
- Geen productiedatabase, deployment, externe integratie of echte dataverwerking zonder opdracht die dit dekt. Initialisatie is documentatie-only.

## Beveiliging

- Respecteer precies vier rollen: Super Admin, Sponsorcommissie, Clubbestuur en Sponsor. Publiek is geen extra gebruikersrol.
- Autorisatie zowel server-side als in database/Storage; sponsor uitsluitend eigen bedrijfsdata via actieve, door vertrouwde processen beheerde machtiging. Nooit vertrouwen op client-ID's, UI-afscherming of wijzigbare `user_metadata`.
- RLS en minimale grants op alle blootgestelde tabellen. Test SELECT/INSERT/UPDATE/DELETE, bedrijfsoverschrijdende verwijzingen en rol-/machtigingswijzigingen. Updatepolicies gebruiken `USING` en `WITH CHECK`. RLS beschermt geen kolommen: interne data apart afschermen.
- Gebruikersqueries met de eigen sessie. Secret/service-role-keys uitsluitend server-side voor begrensde beheerprocessen, nooit in `NEXT_PUBLIC_`, broncode, logs of chat. Geen onveilige views of algemeen toegankelijke privilegefuncties.
- Contracten, facturen en bewijs standaard privé; Storage-autorisatie en korte downloadlinks. Alleen expliciet goedgekeurde inhoud publiceren met geldige toestemming; ook publieke bestanden en caches meenemen bij intrekking.
- Valideer invoer server-side met Zod én databaseconstraints. Beveilig exports, uploads, uitnodigingen en publieke aanvragen.
- Verzin geen officiële sponsoren, pakketten, prijzen of contracten. Alleen duidelijk gemarkeerde fictieve testdata en `.example`-contactadressen in geïsoleerde lokale/testomgevingen; geen productieseeds.
- Maak geen nepfunctionaliteit. UI-succes betekent een echte geslaagde operatie; ontbrekende integratie of configuratie expliciet melden.

## Afronden van iedere ontwikkelfase

- Voer beschikbare relevante controles/tests uit, los fouten op en noteer exacte resultaten en beperkingen. Claim geen test of werkende functie die niet daadwerkelijk is uitgevoerd/gecontroleerd.
- Werk `PROJECT.md` bij voor fase/status, belangrijke technische besluiten en gewijzigde architectuur/acceptatiecriteria. Houd het een overzichtelijk projectkader.
- Werk `PROGRESS.md` bij voor afgeronde onderdelen, gewijzigde bestanden, controles, open taken, bekende problemen en benodigde configuratie. Houd alle drie documenten consistent; registreer beslissingen met een stabiel ID in `PROJECT.md`.
- Rapporteer in het Nederlands wat daadwerkelijk werkt, wat nog ontbreekt, welke handelingen/configuratie nodig zijn en welke fase daarna kan worden opgedragen. Begin die volgende fase niet automatisch.
