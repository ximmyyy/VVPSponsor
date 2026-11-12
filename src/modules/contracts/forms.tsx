"use client";
import {
  useActionState,
  useState,
  useTransition,
  useId,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  blankContract,
  contractSchema,
  packageSchema,
  versionSchema,
  type ContractInput,
  type PackageInput,
  type VersionInput,
} from "./schema";
import { saveContract, savePackage, saveVersion, type Result } from "./actions";

const subscribe = () => () => {};
const useReady = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

function Status({ result }: { result: Result | null }) {
  if (!result?.message) return null;
  return (
    <p
      role="status"
      className={result.ok ? "text-sm" : "text-sm text-destructive"}
    >
      {result.message}
    </p>
  );
}

function Input({
  id,
  label,
  error,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
} & React.ComponentProps<"input">) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="crm-input"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PackageForm({
  id = null,
  values = { name: "", description: "" },
}: {
  id?: string | null;
  values?: PackageInput;
}) {
  const ready = useReady();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PackageInput>({
    resolver: zodResolver(packageSchema),
    defaultValues: values,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      method="post"
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit((data) =>
        start(async () => setResult(await savePackage(id, data))),
      )}
    >
      <Input
        id="package-name"
        label="Pakketnaam *"
        error={errors.name?.message}
        {...register("name")}
      />
      <div>
        <label
          htmlFor="package-description"
          className="block text-sm font-medium"
        >
          Omschrijving
        </label>
        <textarea
          id="package-description"
          rows={3}
          className="crm-input"
          {...register("description")}
        />
      </div>
      <Status result={result} />
      <Button disabled={pending || !ready}>
        {pending ? "Opslaan…" : "Pakket opslaan"}
      </Button>
    </form>
  );
}

export function VersionForm({
  packageId,
  versionId = null,
  values = { description: "", list_price: "", vat_rate: "", rights: [] },
}: {
  packageId: string;
  versionId?: string | null;
  values?: VersionInput;
}) {
  const ready = useReady();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<VersionInput>({
    resolver: zodResolver(versionSchema),
    defaultValues: values,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "rights" });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const prefix = versionId ?? "new";
  return (
    <form
      method="post"
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit((data) =>
        start(async () =>
          setResult(await saveVersion(packageId, versionId, data)),
        ),
      )}
    >
      <div className="crm-fields">
        <Input
          id={`${prefix}-price`}
          label="Richtprijs (EUR)"
          inputMode="decimal"
          error={errors.list_price?.message}
          {...register("list_price")}
        />
        <Input
          id={`${prefix}-vat`}
          label="BTW-tarief (%) — optioneel"
          inputMode="decimal"
          error={errors.vat_rate?.message}
          {...register("vat_rate")}
        />
      </div>
      <div>
        <label
          htmlFor={`${prefix}-description`}
          className="block text-sm font-medium"
        >
          Omschrijving van deze versie
        </label>
        <textarea
          id={`${prefix}-description`}
          rows={3}
          className="crm-input"
          {...register("description")}
        />
      </div>
      <fieldset className="space-y-4">
        <legend className="font-semibold">
          Standaardrechten in deze versie
        </legend>
        {!fields.length && (
          <p className="text-sm text-muted-foreground">
            Nog geen rechten. Voeg ze toe voordat je publiceert, of laat leeg
            voor een pakket zonder vaste rechten.
          </p>
        )}
        {fields.map((field, i) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end"
          >
            <Input
              id={`${prefix}-r${i}-description`}
              label={`Recht ${i + 1}`}
              error={errors.rights?.[i]?.description?.message}
              {...register(`rights.${i}.description`)}
            />
            <Input
              id={`${prefix}-r${i}-quantity`}
              label="Aantal"
              inputMode="decimal"
              error={errors.rights?.[i]?.quantity?.message}
              {...register(`rights.${i}.quantity`)}
            />
            <Input
              id={`${prefix}-r${i}-unit`}
              label="Eenheid"
              error={errors.rights?.[i]?.unit?.message}
              {...register(`rights.${i}.unit`)}
            />
            <Input
              id={`${prefix}-r${i}-timing`}
              label="Planning"
              {...register(`rights.${i}.timing`)}
            />
            <Button type="button" variant="outline" onClick={() => remove(i)}>
              Verwijder
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({ description: "", quantity: "1", unit: "", timing: "" })
          }
        >
          Recht toevoegen
        </Button>
      </fieldset>
      <Status result={result} />
      <Button disabled={pending || !ready}>
        {pending
          ? "Opslaan…"
          : versionId
            ? "Conceptversie opslaan"
            : "Nieuwe conceptversie maken"}
      </Button>
    </form>
  );
}

export function ContractForm({
  company,
  id = null,
  values = blankContract,
}: {
  company: string;
  id?: string | null;
  values?: ContractInput;
}) {
  const ready = useReady();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContractInput>({
    resolver: zodResolver(contractSchema),
    defaultValues: values,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      method="post"
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit((data) =>
        start(async () => setResult(await saveContract(company, id, data))),
      )}
    >
      <Input
        id="contract-title"
        label="Contracttitel *"
        error={errors.title?.message}
        {...register("title")}
      />
      <div className="crm-fields">
        <Input
          id="contract-start"
          type="date"
          label="Begindatum *"
          error={errors.starts_on?.message}
          {...register("starts_on")}
        />
        <Input
          id="contract-end"
          type="date"
          label="Einddatum *"
          error={errors.ends_on?.message}
          {...register("ends_on")}
        />
        <Input
          id="contract-notice"
          type="date"
          label="Uiterste opzegdatum"
          error={errors.notice_deadline?.message}
          {...register("notice_deadline")}
        />
      </div>
      <div>
        <label htmlFor="contract-renewal" className="block text-sm font-medium">
          Verlengafspraken
        </label>
        <textarea
          id="contract-renewal"
          rows={2}
          className="crm-input"
          {...register("renewal_terms")}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Er is geen stilzwijgende automatische verlenging; een verlenging is
          altijd een nieuw contract.
        </p>
      </div>
      <div>
        <label htmlFor="contract-terms" className="block text-sm font-medium">
          Voorwaarden
        </label>
        <textarea
          id="contract-terms"
          rows={5}
          className="crm-input"
          {...register("terms")}
        />
      </div>
      <Status result={result} />
      <Button disabled={pending || !ready}>
        {pending
          ? "Opslaan…"
          : id
            ? "Concept opslaan"
            : "Conceptcontract maken"}
      </Button>
    </form>
  );
}

/** Formulier met serveractie; native velden, server-side Zod-validatie. */
export function StateForm({
  action,
  hidden,
  children,
  submit,
  confirm,
  variant = "outline",
  className = "space-y-4",
}: {
  action: (state: Result, data: FormData) => Promise<Result>;
  hidden: Record<string, string>;
  children?: ReactNode;
  submit: string;
  confirm?: string;
  variant?: "outline" | "default" | "destructive";
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {
    ok: false,
    message: "",
  });
  return (
    <form
      action={run}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <Button variant={variant} disabled={pending}>
        {pending ? "Even wachten…" : submit}
      </Button>
      <Status result={state} />
    </form>
  );
}

/** Native veld voor serveracties; label altijd gekoppeld via useId. */
export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  hint,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  inputMode?: "decimal";
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        accept={
          type === "file" ? "application/pdf,image/png,image/jpeg" : undefined
        }
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="crm-input"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
export function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />{" "}
      {label}
    </label>
  );
}
