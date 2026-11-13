import { requirePortal } from "@/modules/portal/access";
import { Badge } from "@/components/ui/badge";
import { Field, StateForm } from "@/modules/contracts/forms";
import {
  submitProfileRequest,
  withdrawRequest,
} from "@/modules/portal/actions";
import {
  fieldLabel,
  profileFields,
  requestStatus,
} from "@/modules/portal/schema";
import { formatDate } from "@/modules/contracts/schema";

export default async function PortalCompany() {
  const { client, sponsorId } = await requirePortal();
  const [company, requests] = await Promise.all([
    client.rpc("portal_company"),
    client
      .from("sponsor_requests")
      .select("id,proposed,message,status,answer,created_at,reviewed_at")
      .eq("sponsor_id", sponsorId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (company.error || requests.error)
    throw new Error("Bedrijfsgegevens konden niet geladen worden.");
  const data = (company.data || {}) as Record<string, string | null | boolean>;
  const value = (k: string) =>
    typeof data[k] === "string" ? (data[k] as string) : "";
  return (
    <>
      <p className="eyebrow">Bedrijf</p>
      <h1 className="mt-2 text-3xl font-semibold">Bedrijfsgegevens</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Klopt er iets niet? Vraag een wijziging aan. De sponsorcommissie
        beoordeelt je verzoek en verwerkt het.
      </p>
      <div className="dash-two mt-6">
        <section className="dash-panel" aria-labelledby="huidig">
          <h2 id="huidig">Zoals bij ons bekend</h2>
          <dl className="crm-definition mt-4">
            {profileFields.map(([k, label]) => (
              <div key={k}>
                <dt>{label}</dt>
                <dd>{value(k) || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="dash-panel" aria-labelledby="wijzigen">
          <h2 id="wijzigen">Wijziging aanvragen</h2>
          {data.archived ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Dit bedrijf is gearchiveerd; neem contact op met de commissie.
            </p>
          ) : (
            <StateForm
              action={submitProfileRequest}
              hidden={{}}
              submit="Verzoek versturen"
              variant="default"
              className="mt-4 space-y-4"
            >
              <div className="crm-fields">
                {profileFields.map(([k, label]) => (
                  <Field
                    key={k}
                    label={label}
                    name={k}
                    defaultValue={value(k)}
                    required={k === "name"}
                    type={k === "email" ? "email" : "text"}
                  />
                ))}
              </div>
              <Field label="Toelichting (optioneel)" name="message" />
              <p className="text-xs text-muted-foreground">
                Alleen gewijzigde velden worden ingediend.
              </p>
            </StateForm>
          )}
        </section>
      </div>
      <section className="dash-panel mt-6" aria-labelledby="verzoeken">
        <h2 id="verzoeken">Mijn verzoeken</h2>
        {requests.data.length ? (
          <ul className="mt-3 space-y-4">
            {requests.data.map((r) => (
              <li
                key={r.id}
                className="border-b border-border pb-4 text-sm last:border-0"
              >
                <p className="flex flex-wrap items-center gap-2">
                  <Badge role="status">
                    {requestStatus[r.status as keyof typeof requestStatus]}
                  </Badge>
                  <span className="text-muted-foreground">
                    ingediend {formatDate(r.created_at)}
                  </span>
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {Object.entries(r.proposed as Record<string, string>).map(
                    ([k, v]) => (
                      <li key={k}>
                        {fieldLabel[k] ?? k}: {v || "(leeg)"}
                      </li>
                    ),
                  )}
                </ul>
                {r.answer && (
                  <p className="mt-2">Reactie commissie: {r.answer}</p>
                )}
                {r.status === "pending" && (
                  <div className="mt-2">
                    <StateForm
                      action={withdrawRequest}
                      hidden={{ id: r.id }}
                      submit="Verzoek intrekken"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Je hebt nog geen wijzigingen aangevraagd.
          </p>
        )}
      </section>
    </>
  );
}
