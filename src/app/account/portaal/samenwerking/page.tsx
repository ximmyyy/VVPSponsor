import Link from "next/link";
import { requirePortal } from "@/modules/portal/access";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import {
  contractPhase,
  formatDate,
  formatEuro,
  todayInAmsterdam,
} from "@/modules/contracts/schema";

type Item = {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  starts_on: string;
  ends_on: string;
};
function ContractList({
  items,
  value,
  today,
}: {
  items: Item[];
  value: Map<string, number | null>;
  today: string;
}) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((c) => (
        <li key={c.id} className="dash-panel">
          <Link
            className="font-semibold text-primary underline"
            href={`/account/portaal/samenwerking/${c.id}`}
          >
            {c.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.contract_number} · {formatDate(c.starts_on)} t/m{" "}
            {formatDate(c.ends_on)}
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <Badge>{contractPhase(c, today)}</Badge>
            <span className="dash-num">
              {formatEuro(value.get(c.id))} incl. BTW
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function Collaboration() {
  const { client, sponsorId } = await requirePortal();
  const contracts = await client
    .from("contracts")
    .select(
      "id,contract_number,title,status,starts_on,ends_on,notice_deadline,terminated_on",
    )
    .eq("sponsor_id", sponsorId)
    .order("starts_on", { ascending: false });
  if (contracts.error)
    throw new Error("Contracten konden niet geladen worden.");
  const ids = contracts.data.map((c) => c.id);
  const totals = ids.length
    ? await client
        .from("contract_totals")
        .select("contract_id,current_total")
        .in("contract_id", ids)
    : { data: [], error: null };
  if (totals.error)
    throw new Error("Contractwaarden konden niet geladen worden.");
  const value = new Map(
    totals.data.map((t) => [t.contract_id, t.current_total]),
  );
  const today = todayInAmsterdam();
  const current = contracts.data.filter(
    (c) => c.status === "confirmed" && c.ends_on >= today,
  );
  const past = contracts.data.filter((c) => !current.includes(c));
  return (
    <>
      <p className="eyebrow">Samenwerking</p>
      <h1 className="mt-2 text-3xl font-semibold">
        Contracten en sponsorrechten
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Je lopende afspraken en de contracten van vorige jaren. Je ziet alleen
        vastgelegde contracten.
      </p>
      <h2 className="mt-8 mb-3 text-xl font-semibold">Lopend</h2>
      {current.length ? (
        <ContractList items={current} value={value} today={today} />
      ) : (
        <EmptyState
          title="Geen lopend contract"
          description="Neem contact op met de sponsorcommissie over een nieuwe samenwerking."
        />
      )}
      <h2 className="mt-8 mb-3 text-xl font-semibold">Vorige jaren</h2>
      {past.length ? (
        <ContractList items={past} value={value} today={today} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Nog geen eerdere contracten.
        </p>
      )}
    </>
  );
}
