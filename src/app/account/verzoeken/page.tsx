import Link from "next/link";
import { requireCrm } from "@/modules/crm/access";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { Field, StateForm } from "@/modules/contracts/forms";
import { reviewRequest } from "@/modules/portal/actions";
import { fieldLabel, requestStatus } from "@/modules/portal/schema";
import { formatDate } from "@/modules/contracts/schema";

export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireCrm();
  const handled = (await searchParams).weergave === "afgehandeld";
  let request = client
    .from("sponsor_requests")
    .select(
      "id,sponsor_id,proposed,previous,message,status,answer,created_at,reviewed_at,sponsors(name,city,sponsor_internal(kvk,vat_number,street,postal_code,email,phone)),trading:sponsors(trading_name,website)",
    )
    .order("created_at", { ascending: handled ? false : true })
    .limit(50);
  request = handled
    ? request.neq("status", "pending")
    : request.eq("status", "pending");
  const result = await request;
  if (result.error) throw new Error("Verzoeken konden niet geladen worden.");
  return (
    <>
      <p className="eyebrow">Sponsorportaal</p>
      <h1 className="mt-2 text-3xl font-semibold">Wijzigingsverzoeken</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Sponsors vragen wijzigingen van hun bedrijfsgegevens aan. Goedkeuren
        verwerkt de wijziging direct en atomair in het CRM; de vorige waarden
        blijven bij het verzoek bewaard.
      </p>
      <nav aria-label="Weergave" className="my-5 flex gap-5 text-sm">
        <Link
          className="min-h-11 content-center underline"
          aria-current={!handled ? "page" : undefined}
          href="/account/verzoeken"
        >
          Open
        </Link>
        <Link
          className="min-h-11 content-center underline"
          aria-current={handled ? "page" : undefined}
          href="/account/verzoeken?weergave=afgehandeld"
        >
          Afgehandeld
        </Link>
      </nav>
      {!result.data.length ? (
        <EmptyState
          title={handled ? "Nog niets afgehandeld" : "Geen open verzoeken"}
          description="Nieuwe verzoeken uit het sponsorportaal verschijnen hier."
        />
      ) : (
        <ul className="space-y-4">
          {result.data.map((r) => {
            const s = r.sponsors;
            const internal = Array.isArray(s?.sponsor_internal)
              ? s?.sponsor_internal[0]
              : s?.sponsor_internal;
            const current: Record<string, string | null | undefined> = {
              name: s?.name,
              city: s?.city,
              trading_name: r.trading?.trading_name,
              website: r.trading?.website,
              ...(internal ?? {}),
            };
            const proposed = r.proposed as Record<string, string>;
            const previous = (r.previous ?? null) as Record<
              string,
              string | null
            > | null;
            return (
              <li key={r.id} className="dash-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    className="font-semibold text-primary underline"
                    href={`/account/sponsors/${r.sponsor_id}`}
                  >
                    {s?.name}
                  </Link>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {formatDate(r.created_at)}{" "}
                    <Badge role="status">
                      {requestStatus[r.status as keyof typeof requestStatus]}
                    </Badge>
                  </span>
                </div>
                <div
                  className="table-scroll mt-3"
                  tabIndex={0}
                  role="region"
                  aria-label="Voorgestelde wijzigingen"
                >
                  <table>
                    <caption className="sr-only">
                      Huidige en voorgestelde waarden
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Veld</th>
                        <th scope="col">
                          {r.status === "approved" ? "Was" : "Nu"}
                        </th>
                        <th scope="col">Voorgesteld</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(proposed).map(([k, v]) => (
                        <tr key={k}>
                          <td>{fieldLabel[k] ?? k}</td>
                          <td>
                            {(previous ? previous[k] : current[k]) || "—"}
                          </td>
                          <td>
                            <strong>{v || "(leeg)"}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {r.message && (
                  <p className="mt-3 text-sm">
                    Toelichting sponsor: {r.message}
                  </p>
                )}
                {r.answer && (
                  <p className="mt-2 text-sm">Reactie: {r.answer}</p>
                )}
                {r.status === "pending" && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <StateForm
                      action={reviewRequest}
                      hidden={{ id: r.id, decision: "approve" }}
                      submit="Goedkeuren en verwerken"
                      variant="default"
                    >
                      <Field
                        label="Bericht aan sponsor (optioneel)"
                        name="reply"
                      />
                    </StateForm>
                    <StateForm
                      action={reviewRequest}
                      hidden={{ id: r.id, decision: "reject" }}
                      submit="Afwijzen"
                    >
                      <Field label="Reden van afwijzen" name="reply" required />
                    </StateForm>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
