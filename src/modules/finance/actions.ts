"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCrm } from "@/modules/crm/access";
import { validateUpload } from "@/modules/contracts/files";
import {
  cents,
  invoiceDraftSchema,
  invoiceLineSchema,
  issueSchema,
  paymentSchema,
} from "./schema";

export type Result = { ok: boolean; message: string };
const invalid: Result = {
  ok: false,
  message: "Controleer de invoer en probeer opnieuw.",
};
function failure(code?: string): Result {
  const messages: Record<string, string> = {
    "23505":
      "Er bestaat al een gelijke registratie (bedrag, datum en kenmerk). Vink 'toch registreren' aan als dit echt een tweede betaling is.",
    "23514":
      "De bedragen of datums voldoen niet aan de regels (open bedrag, contractregel, vervaldatum of toekomstige datum).",
    "23503": "De gekozen koppeling hoort niet bij dit bedrijf.",
    "42501":
      "Deze handeling is niet toegestaan in de huidige status of voor jouw rol.",
    P0002: "Het gevraagde record is niet (meer) beschikbaar.",
    "22P02": "Een ingevoerde waarde heeft een ongeldig formaat.",
    "22007": "Een ingevoerde datum is ongeldig.",
    "22008": "Een ingevoerde datum is ongeldig.",
    "22003": "Een bedrag is te groot.",
  };
  return {
    ok: false,
    message:
      (code && messages[code]) ||
      "Opslaan niet gelukt. Er is niets gewijzigd; probeer het opnieuw.",
  };
}
const fields = (form: FormData) =>
  Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
const uuid = z.uuid();
const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message || invalid.message;
const invoicePath = (id: string) => `/account/financien/facturen/${id}`;
function touch(...paths: string[]) {
  revalidatePath("/account/financien");
  for (const p of paths) revalidatePath(p);
}

export async function createInvoice(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = invoiceDraftSchema.safeParse(f);
  if (
    !parsed.success ||
    !uuid.safeParse(f.company).success ||
    (f.contract && !uuid.safeParse(f.contract).success)
  )
    return parsed.success
      ? invalid
      : { ok: false, message: firstIssue(parsed.error) };
  const { data, error } = await client.rpc("create_invoice", {
    company: f.company,
    details: { ...parsed.data, contract_id: f.contract || "" },
  });
  if (error || !data) return failure(error?.code);
  touch();
  redirect(invoicePath(data));
}
export async function updateInvoiceDraft(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = invoiceDraftSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.id).success)
    return parsed.success
      ? invalid
      : { ok: false, message: firstIssue(parsed.error) };
  const { error } = await client.rpc("update_invoice_draft", {
    target: f.id,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touch(invoicePath(f.id));
  return { ok: true, message: "Concept opgeslagen." };
}
export async function addInvoiceLine(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = invoiceLineSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.invoice).success)
    return parsed.success
      ? invalid
      : { ok: false, message: firstIssue(parsed.error) };
  const { error } = await client.rpc("add_invoice_line", {
    invoice: f.invoice,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touch(invoicePath(f.invoice));
  return { ok: true, message: "Regel toegevoegd." };
}
export async function removeInvoiceLine(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z.object({ id: uuid, invoice: uuid }).safeParse(fields(form));
  if (!p.success) return invalid;
  const { error } = await client.rpc("remove_invoice_line", {
    target: p.data.id,
  });
  if (error) return failure(error.code);
  touch(invoicePath(p.data.invoice));
  return { ok: true, message: "Regel verwijderd." };
}
export async function deleteInvoiceDraft(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return invalid;
  const { error } = await client.rpc("delete_invoice_draft", {
    target: id.data,
  });
  if (error) return failure(error.code);
  touch();
  redirect("/account/financien");
}
export async function issueInvoice(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = issueSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.id).success)
    return parsed.success
      ? invalid
      : { ok: false, message: firstIssue(parsed.error) };
  const { data, error } = await client.rpc("issue_invoice", {
    target: f.id,
    details: { issue_date: parsed.data.issue_date, due_on: parsed.data.due_on },
  });
  if (error || !data) return failure(error?.code);
  touch(invoicePath(f.id));
  return {
    ok: true,
    message: `Uitgereikt als ${data}. De factuur is nu vastgelegd; corrigeren kan alleen met een creditnota.`,
  };
}
export async function createCreditNote(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({ id: uuid, full: z.enum(["yes", "no"]) })
    .safeParse(fields(form));
  if (!p.success) return invalid;
  const { data, error } = await client.rpc("create_credit_note", {
    original: p.data.id,
    details: { full: p.data.full === "yes" },
  });
  if (error || !data) return failure(error?.code);
  touch(invoicePath(p.data.id));
  redirect(invoicePath(data));
}
export async function registerPayment(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = paymentSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.company).success)
    return parsed.success
      ? invalid
      : { ok: false, message: firstIssue(parsed.error) };
  const { data, error } = await client.rpc("register_payment", {
    company: f.company,
    details: parsed.data,
  });
  if (error || !data) return failure(error?.code);
  touch();
  redirect(`/account/financien/betalingen/${data}`);
}
export async function allocate(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({
      source: uuid,
      target: uuid,
      kind: z.enum(["payment", "credit"]),
      amount: cents,
      back: z.string().regex(/^\/account\/financien\//),
    })
    .safeParse(fields(form));
  if (!p.success)
    return {
      ok: false,
      message: "Kies een factuur en vul een geldig bedrag in.",
    };
  const { source, target, kind, amount } = p.data;
  // Bedrag gaat als exacte tekst naar PostgreSQL numeric.
  const { error } =
    kind === "payment"
      ? await client.rpc("allocate_payment", {
          payment: source,
          invoice: target,
          amount: amount as unknown as number,
        })
      : await client.rpc("allocate_credit", {
          credit: source,
          target,
          amount: amount as unknown as number,
        });
  if (error) return failure(error.code);
  touch(p.data.back, invoicePath(target));
  return { ok: true, message: "Toegewezen." };
}
export async function reverseAllocation(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({
      id: uuid,
      kind: z.enum(["payment", "credit"]),
      back: z.string().regex(/^\/account\/financien\//),
    })
    .safeParse(fields(form));
  if (!p.success) return invalid;
  const { error } = await client.rpc("reverse_allocation", {
    target: p.data.id,
    kind: p.data.kind,
  });
  if (error) return failure(error.code);
  touch(p.data.back);
  return {
    ok: true,
    message: "Toewijzing teruggedraaid; de historie blijft zichtbaar.",
  };
}
export async function reversePayment(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({ id: uuid, reason: z.string().trim().min(1).max(2000) })
    .safeParse(fields(form));
  if (!p.success) return { ok: false, message: "Vul een reden in." };
  const { error } = await client.rpc("reverse_payment", {
    target: p.data.id,
    reason: p.data.reason,
  });
  if (error) return failure(error.code);
  touch(`/account/financien/betalingen/${p.data.id}`);
  return {
    ok: true,
    message: "Betaling teruggedraaid, inclusief alle toewijzingen.",
  };
}
export async function uploadInvoiceDocument(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const meta = z
    .object({
      company: uuid,
      invoice: uuid,
      title: z.string().trim().min(1).max(160),
      sponsor_shared: z.string().optional(),
    })
    .safeParse(f);
  const file = form.get("file");
  if (!meta.success || !(file instanceof File))
    return { ok: false, message: "Vul een titel in en kies een bestand." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload(bytes, file.type);
  if (!check.ok) return { ok: false, message: check.message };
  if (check.type !== "application/pdf")
    return { ok: false, message: "Een factuurdocument moet een PDF zijn." };
  const m = meta.data;
  const { data: id, error } = await client.rpc("register_document", {
    company: m.company,
    details: {
      title: m.title,
      mime_type: check.type,
      size_bytes: bytes.length,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      sponsor_shared: m.sponsor_shared === "on",
      board_shared: false,
    },
    link: { invoice_id: m.invoice },
  });
  if (error || !id) return failure(error?.code);
  const upload = await client.storage
    .from("private-documents")
    .upload(`${m.company}/${id}`, bytes, {
      contentType: check.type,
      upsert: false,
    });
  if (upload.error)
    return {
      ok: false,
      message:
        "Bestand niet opgeslagen. Het record blijft in afwachting en is buiten de commissie onzichtbaar.",
    };
  const done = await client.rpc("finalize_document", { target: id });
  if (done.error)
    return { ok: false, message: "Bestand geüpload maar controle mislukt." };
  touch(invoicePath(m.invoice));
  return {
    ok: true,
    message:
      m.sponsor_shared === "on"
        ? "Factuur-PDF opgeslagen en gedeeld met de sponsor."
        : "Factuur-PDF privé opgeslagen.",
  };
}
