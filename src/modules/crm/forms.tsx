"use client";
import {
  useActionState,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import {
  useForm,
  type FieldValues,
  type UseFormRegister,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  companySchema,
  contactSchema,
  blankCompany,
  type CompanyInput,
  type ContactInput,
} from "./schema";
import { saveCompany, saveContact, type Result } from "./actions";
const subscribe = () => () => {};
function useFormReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
function Field<T extends FieldValues>({
  name,
  label,
  register,
  error,
  type = "text",
  multiline = false,
}: {
  name: Path<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: string;
  type?: string;
  multiline?: boolean;
}) {
  const id = `field-${name}`;
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          {...register(name)}
          rows={5}
          className="crm-input"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      ) : (
        <input
          id={id}
          required={name === "name"}
          type={type}
          {...register(name)}
          className="crm-input"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}{" "}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function CompanyForm({
  id = null,
  values = blankCompany,
  owners = [],
}: {
  id?: string | null;
  values?: CompanyInput;
  owners: { user_id: string; label: string }[];
}) {
  const ready = useFormReady();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: values,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      method="post"
      onSubmit={handleSubmit((data) =>
        start(async () => {
          setResult(await saveCompany(id, data));
        }),
      )}
      className="space-y-8"
      noValidate
    >
      <fieldset className="crm-fields">
        <legend className="mb-4 text-lg font-semibold">Bedrijfsprofiel</legend>
        {(["name", "trading_name", "website", "city"] as const).map(
          (name, i) => (
            <Field
              key={name}
              name={name}
              label={["Bedrijfsnaam *", "Handelsnaam", "Website", "Plaats"][i]}
              register={register}
              error={errors[name]?.message}
            />
          ),
        )}
      </fieldset>
      <fieldset className="crm-fields">
        <legend className="mb-4 text-lg font-semibold">
          Interne administratie
        </legend>
        <div>
          <label htmlFor="company-status" className="block text-sm font-medium">
            Relatiestatus
          </label>
          <select
            id="company-status"
            className="crm-input"
            {...register("status")}
          >
            <option value="prospect">Prospect</option>
            <option value="active">Actief</option>
            <option value="inactive">Inactief</option>
          </select>
        </div>
        <div>
          <label htmlFor="company-owner" className="block text-sm font-medium">
            Verantwoordelijke
          </label>
          <select
            id="company-owner"
            className="crm-input"
            {...register("owner_id")}
          >
            <option value="">Niet toegewezen</option>
            {values.owner_id &&
              !owners.some((o) => o.user_id === values.owner_id) && (
                <option value={values.owner_id}>
                  Eerder toegewezen account
                </option>
              )}
            {owners.map((o) => (
              <option value={o.user_id} key={o.user_id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {(
          [
            "kvk",
            "vat_number",
            "street",
            "postal_code",
            "email",
            "phone",
          ] as const
        ).map((name, i) => (
          <Field
            key={name}
            name={name}
            label={
              [
                "KvK-nummer",
                "BTW-nummer",
                "Straat en huisnummer",
                "Postcode",
                "Zakelijk e-mailadres",
                "Telefoon",
              ][i]
            }
            register={register}
            error={errors[name]?.message}
            type={name === "email" ? "email" : "text"}
          />
        ))}
      </fieldset>
      <Field
        name="notes"
        label="Interne notities"
        multiline
        register={register}
        error={errors.notes?.message}
      />
      <p className="text-sm text-muted-foreground">
        Interne administratie en contactpersonen zijn uitsluitend voor de
        sponsorcommissie en Super Admin.
      </p>
      {result && (
        <p role="status" className={result.ok ? "" : "text-destructive"}>
          {result.message}
        </p>
      )}
      <Button disabled={pending || !ready}>
        {pending ? "Opslaan…" : "Bedrijf opslaan"}
      </Button>
    </form>
  );
}
export function ContactForm({
  company,
  id = null,
  values = { name: "", position: "", email: "", phone: "", is_primary: false },
}: {
  company: string;
  id?: string | null;
  values?: ContactInput;
}) {
  const ready = useFormReady();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: values,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      method="post"
      onSubmit={handleSubmit((data) =>
        start(async () => {
          const answer = await saveContact(company, id, data);
          setResult(answer);
          if (answer.ok && !id) reset();
        }),
      )}
      className="space-y-5"
      noValidate
    >
      <div className="crm-fields">
        {(["name", "position", "email", "phone"] as const).map((name, i) => (
          <Field
            key={name}
            name={name}
            label={
              [
                "Naam contactpersoon *",
                "Functie",
                "E-mailadres contactpersoon",
                "Telefoon contactpersoon",
              ][i]
            }
            register={register}
            error={errors[name]?.message}
          />
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" {...register("is_primary")} /> Primair
        contactpersoon
      </label>
      {result && <p role="status">{result.message}</p>}
      <Button disabled={pending || !ready}>
        {pending ? "Opslaan…" : "Contactpersoon opslaan"}
      </Button>
    </form>
  );
}
export function ActionForm({
  action,
  fields,
  label,
  confirm,
}: {
  action: (state: Result, data: FormData) => Promise<Result>;
  fields: Record<string, string>;
  label: string;
  confirm?: string;
}) {
  const [state, submit, pending] = useActionState(action, {
    ok: false,
    message: "",
  });
  return (
    <form
      action={submit}
      className="space-y-3"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button variant="outline" disabled={pending}>
        {pending ? "Even wachten…" : label}
      </Button>
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
