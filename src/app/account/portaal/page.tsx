import Link from "next/link";
import { CalendarClock, FileText, Handshake, Mail, Trophy } from "lucide-react";
import { requirePortal } from "@/modules/portal/access";
import { contactHref } from "@/modules/portal/schema";
import {
  formatDate,
  formatEuro,
  todayInAmsterdam,
} from "@/modules/contracts/schema";

export default async function PortalHome() {
  const { client, sponsorId } = await requirePortal();
  const today = todayInAmsterdam();
  // Alle queries met de eigen sessie; RLS beperkt tot het eigen bedrijf.
  const [company, contracts, rights, balances, settings] = await Promise.all([
    client.from("sponsors").select("name").eq("id", sponsorId).single(),
    client
      .from("contracts")
      .select(
        "id,contract_number,title,status,starts_on,ends_on,notice_deadline",
      )
      .eq("sponsor_id", sponsorId)
      .order("starts_on", { ascending: false }),
    client
      .from("contract_rights")
      .select("id,status,contract_id")
      .eq("sponsor_id", sponsorId),
    client
      .from("invoice_balances")
      .select("invoice_id,invoice_number,kind,open_amount,due_on")
      .eq("sponsor_id", sponsorId)
      .eq("kind", "invoice"),
    client.from("club_settings").select("contact_email").maybeSingle(),
  ]);
  for (const r of [company, contracts, rights, balances])
    if (r.error) throw new Error("Je overzicht kon niet geladen worden.");
  const current = contracts.data!.filter(
    (c) =>
      c.status === "confirmed" && c.ends_on >= today && c.starts_on <= today,
  );
  const ids = current.map((c) => c.id);
  const totals = ids.length
    ? await client
        .from("contract_totals")
        .select("contract_id,current_total")
        .in("contract_id", ids)
    : { data: [], error: null };
  if (totals.error) throw new Error("Contractwaarde kon niet geladen worden.");
  const currentRights = rights.data!.filter(
    (r) => ids.includes(r.contract_id) && r.status !== "cancelled",
  );
  const done = currentRights.filter((r) => r.status === "fulfilled").length;
  const open = balances.data!.filter((b) => Number(b.open_amount) > 0);
  const overdue = open.filter((b) => b.due_on && b.due_on < today);
  const mail = contactHref(settings.data?.contact_email, company.data!.name);
  const nextNotice = current
    .map((c) => c.notice_deadline)
    .filter((d): d is string => !!d && d >= today)
    .sort()[0];

  return (
    <>
      <p className="eyebrow">Welkom</p>
      <h1 className="mt-2 text-3xl font-semibold break-words">
        {company.data!.name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dank voor je steun aan VV Pernis. Hier zie je je samenwerking,
        sponsorrechten en facturen.
      </p>

      <section className="dash-grid mt-6" aria-label="Samenvatting">
        <div className="dash-tile">
          <p className="dash-tile-label">
            <Handshake className="size-4" aria-hidden="true" /> Lopende
            samenwerking
          </p>
          <p className="dash-tile-value">
            {current.length
              ? `${current.length} ${current.length === 1 ? "contract" : "contracten"}`
              : "Geen"}
          </p>
          <div className="dash-tile-note">
            {totals.data.length
              ? `Waarde ${formatEuro(totals.data.reduce((sum, t) => sum + Number(t.current_total), 0))} incl. BTW`
              : "Geen lopend contract"}
          </div>
        </div>
        <div className="dash-tile">
          <p className="dash-tile-label">
            <Trophy className="size-4" aria-hidden="true" /> Sponsorrechten
          </p>
          <p className="dash-tile-value">
            {done} van {currentRights.length}
          </p>
          <div className="dash-tile-note">
            uitgevoerd in je lopende contract(en)
          </div>
          {currentRights.length > 0 && (
            <div
              className="mt-1 h-2 w-full rounded-full bg-secondary"
              role="progressbar"
              aria-label="Uitgevoerde sponsorrechten"
              aria-valuemin={0}
              aria-valuemax={currentRights.length}
              aria-valuenow={done}
            >
              <div
                className="h-2 rounded-full bg-primary"
                style={{
                  width: `${Math.round((done / currentRights.length) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
        <div className="dash-tile">
          <p className="dash-tile-label">
            <FileText className="size-4" aria-hidden="true" /> Openstaande
            facturen
          </p>
          <p className="dash-tile-value">{open.length}</p>
          <div className="dash-tile-note">
            {overdue.length ? (
              <span className="dash-pill dash-pill-danger">
                {overdue.length} na vervaldatum
              </span>
            ) : open.length ? (
              "Binnen de betaaltermijn"
            ) : (
              "Alles voldaan"
            )}
          </div>
        </div>
        <div className="dash-tile">
          <p className="dash-tile-label">
            <CalendarClock className="size-4" aria-hidden="true" /> Belangrijke
            datum
          </p>
          <p className="dash-tile-value text-xl">
            {nextNotice
              ? formatDate(nextNotice)
              : current[0]
                ? formatDate(current[0].ends_on)
                : "—"}
          </p>
          <div className="dash-tile-note">
            {nextNotice
              ? "Uiterste opzegdatum"
              : current[0]
                ? "Einde lopend contract"
                : "Geen lopend contract"}
          </div>
        </div>
      </section>

      <section className="dash-two mt-6">
        <div className="dash-panel">
          <h2>Snel naar</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {[
              [
                "/account/portaal/samenwerking",
                "Contracten en sponsorrechten (ook vorige jaren)",
              ],
              ["/account/portaal/facturen", "Facturen en betalingen"],
              [
                "/account/portaal/bedrijf",
                "Bedrijfsgegevens bekijken of wijziging aanvragen",
              ],
              ["/account/portaal/collegas", "Collega's toegang geven"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="dash-panel">
          <h2 className="flex items-center gap-2">
            <Mail className="size-4" aria-hidden="true" /> Contact met de
            sponsorcommissie
          </h2>
          {mail ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Vragen over je samenwerking? Mail de sponsorcommissie; we
                reageren zo snel mogelijk.
              </p>
              <a
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                href={mail}
              >
                <Mail className="size-4" aria-hidden="true" /> E-mail sturen
              </a>
              <p className="mt-2 text-xs text-muted-foreground break-all">
                {settings.data?.contact_email}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Het contactadres van de commissie is nog niet ingesteld. Gebruik
              voorlopig je bekende contactpersoon.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
