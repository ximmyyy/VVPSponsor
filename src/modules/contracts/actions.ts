"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCrm } from "@/modules/crm/access";
import {
  amendmentSchema,
  contractSchema,
  fulfillmentSchema,
  lineSchema,
  packageSchema,
  renewalSchema,
  rightSchema,
  rightUpdateSchema,
  terminationSchema,
  versionSchema,
} from "./schema";
import { validateUpload } from "./files";

export type Result = { ok: boolean; message: string };
const invalid: Result = {
  ok: false,
  message: "Controleer de invoer en probeer opnieuw.",
};
function failure(code?: string): Result {
  const messages: Record<string, string> = {
    "23505": "Deze naam of opvolger bestaat al.",
    "23514":
      "De gegevens voldoen niet aan de regels (datum, bedrag, reden of verplichte regel).",
    "23503": "De gekozen koppeling hoort niet bij dit contract of bedrijf.",
    "42501":
      "Deze handeling is niet toegestaan in de huidige status of voor jouw rol.",
    P0002: "Het gevraagde record is niet (meer) beschikbaar.",
    "22P02": "Een ingevoerde waarde heeft een ongeldig formaat.",
    "22007": "Een ingevoerde datum is ongeldig.",
    "22008": "Een ingevoerde datum is ongeldig.",
    "22003": "Een bedrag of aantal is te groot.",
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
const contractPath = (id: string) => `/account/contracten/${id}`;
function touchContract(id: string) {
  revalidatePath(contractPath(id));
  revalidatePath("/account/contracten");
  revalidatePath("/account/sponsorrechten");
}

// Pakketten --------------------------------------------------------------------
export async function savePackage(
  id: string | null,
  input: unknown,
): Promise<Result> {
  const { client } = await requireCrm();
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success || (id && !uuid.safeParse(id).success)) return invalid;
  const { data, error } = await client.rpc("save_package", {
    target: id!,
    details: parsed.data,
  });
  if (error || !data) return failure(error?.code);
  revalidatePath("/account/pakketten");
  redirect(`/account/pakketten/${data}`);
}
export async function archivePackage(_: Result, form: FormData) {
  const { client } = await requireCrm();
  const p = z
    .object({ id: uuid, archive: z.enum(["yes", "no"]) })
    .safeParse(fields(form));
  if (!p.success) return invalid;
  const { error } = await client.rpc("set_package_archived", {
    target: p.data.id,
    archive: p.data.archive === "yes",
  });
  if (error) return failure(error.code);
  revalidatePath("/account/pakketten");
  revalidatePath(`/account/pakketten/${p.data.id}`);
  return {
    ok: true,
    message:
      p.data.archive === "yes"
        ? "Pakket gearchiveerd. Bestaande contracten blijven ongewijzigd."
        : "Pakket hersteld.",
  };
}
export async function saveVersion(
  packageId: string,
  versionId: string | null,
  input: unknown,
): Promise<Result> {
  const { client } = await requireCrm();
  const parsed = versionSchema.safeParse(input);
  if (
    !parsed.success ||
    !uuid.safeParse(packageId).success ||
    (versionId && !uuid.safeParse(versionId).success)
  )
    return invalid;
  const { error } = await client.rpc("save_package_version", {
    target: versionId!,
    package: packageId,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  revalidatePath(`/account/pakketten/${packageId}`);
  return {
    ok: true,
    message: versionId
      ? "Conceptversie opgeslagen."
      : "Nieuwe conceptversie aangemaakt.",
  };
}
export async function changeVersion(_: Result, form: FormData) {
  const { client } = await requireCrm();
  const p = z
    .object({
      id: uuid,
      package: uuid,
      action: z.enum(["publish", "retire"]),
    })
    .safeParse(fields(form));
  if (!p.success) return invalid;
  const { error } = await client.rpc(
    p.data.action === "publish"
      ? "publish_package_version"
      : "retire_package_version",
    { target: p.data.id },
  );
  if (error) return failure(error.code);
  revalidatePath(`/account/pakketten/${p.data.package}`);
  return {
    ok: true,
    message:
      p.data.action === "publish"
        ? "Versie gepubliceerd en vergrendeld. Een eventuele vorige versie is uitgefaseerd."
        : "Versie uitgefaseerd. Bestaande contracten blijven ongewijzigd.",
  };
}

// Contracten ---------------------------------------------------------------------
export async function saveContract(
  company: string,
  id: string | null,
  input: unknown,
): Promise<Result> {
  const { client } = await requireCrm();
  const parsed = contractSchema.safeParse(input);
  if (
    !parsed.success ||
    !uuid.safeParse(company).success ||
    (id && !uuid.safeParse(id).success)
  )
    return invalid;
  if (id) {
    const { error } = await client.rpc("update_contract_draft", {
      target: id,
      details: parsed.data,
    });
    if (error) return failure(error.code);
    touchContract(id);
    return { ok: true, message: "Concept opgeslagen." };
  }
  const { data, error } = await client.rpc("create_contract", {
    company,
    details: parsed.data,
  });
  if (error || !data) return failure(error?.code);
  touchContract(data);
  redirect(contractPath(data));
}
export async function addLine(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = lineSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.contract).success)
    return {
      ok: false,
      message: parsed.success
        ? invalid.message
        : parsed.error.issues[0]?.message || invalid.message,
    };
  const { error } = await client.rpc("add_contract_line", {
    contract: f.contract,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touchContract(f.contract);
  return {
    ok: true,
    message: parsed.data.package_version_id
      ? "Pakketregel toegevoegd; rechten zijn als eigen afspraken gekopieerd."
      : "Maatwerkregel toegevoegd.",
  };
}
export async function addRight(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = rightSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.contract).success)
    return {
      ok: false,
      message: parsed.success
        ? invalid.message
        : parsed.error.issues[0]?.message || invalid.message,
    };
  const { error } = await client.rpc("add_contract_right", {
    contract: f.contract,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touchContract(f.contract);
  return { ok: true, message: "Sponsorrecht toegevoegd." };
}
export async function removeItem(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({ id: uuid, contract: uuid, kind: z.enum(["line", "right"]) })
    .safeParse(fields(form));
  if (!p.success) return invalid;
  const { error } = await client.rpc(
    p.data.kind === "line" ? "remove_contract_line" : "remove_contract_right",
    { target: p.data.id },
  );
  if (error) return failure(error.code);
  touchContract(p.data.contract);
  return { ok: true, message: "Verwijderd uit het concept." };
}
export async function confirmContract(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return invalid;
  const { error } = await client.rpc("confirm_contract", { target: id.data });
  if (error) return failure(error.code);
  touchContract(id.data);
  return {
    ok: true,
    message:
      "Contract bevestigd. Regels, rechten en partijgegevens zijn vastgelegd; wijzigen kan alleen nog via een amendement.",
  };
}
export async function terminateContract(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = terminationSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.id).success)
    return {
      ok: false,
      message: parsed.success
        ? invalid.message
        : parsed.error.issues[0]?.message || invalid.message,
    };
  const { error } = await client.rpc("terminate_contract", {
    target: f.id,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touchContract(f.id);
  return {
    ok: true,
    message: "Contract beëindigd. De vastgelegde historie blijft bewaard.",
  };
}
export async function renewContract(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = renewalSchema.safeParse(f);
  if (!parsed.success || !uuid.safeParse(f.id).success)
    return {
      ok: false,
      message: parsed.success
        ? invalid.message
        : parsed.error.issues[0]?.message || invalid.message,
    };
  const { data, error } = await client.rpc("renew_contract", {
    target: f.id,
    details: parsed.data,
  });
  if (error || !data) return failure(error?.code);
  touchContract(f.id);
  redirect(contractPath(data));
}
export async function addAmendment(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const line = f.line_title
    ? [
        {
          title: f.line_title,
          description: f.line_description || "",
          quantity: f.line_quantity || "1",
          unit_price: f.line_unit_price || "",
          vat_rate: f.line_vat_rate || "",
        },
      ]
    : [];
  const right = f.right_description
    ? [
        {
          description: f.right_description,
          quantity: f.right_quantity || "1",
          unit: f.right_unit || "",
          deadline: f.right_deadline || "",
          responsible_id: "",
          portal_visible: f.right_portal_visible || "",
        },
      ]
    : [];
  const parsed = amendmentSchema.safeParse({
    effective_on: f.effective_on,
    reason: f.reason,
    ends_on: f.ends_on || "",
    notice_deadline: f.notice_deadline || "",
    change_notice: f.change_notice || "",
    add_lines: line,
    add_rights: right,
    cancel_rights: form.getAll("cancel_rights").map(String),
  });
  if (!parsed.success || !uuid.safeParse(f.id).success)
    return {
      ok: false,
      message: parsed.success
        ? invalid.message
        : parsed.error.issues[0]?.message || invalid.message,
    };
  const { change_notice, notice_deadline, ends_on, ...rest } = parsed.data;
  const details: Record<string, unknown> = { ...rest };
  if (ends_on) details.ends_on = ends_on;
  if (change_notice) details.notice_deadline = notice_deadline;
  const { error } = await client.rpc("add_contract_amendment", {
    target: f.id,
    details: details as never,
  });
  if (error) return failure(error.code);
  touchContract(f.id);
  return {
    ok: true,
    message:
      "Amendement vastgelegd. De oorspronkelijke afspraken blijven zichtbaar in de historie.",
  };
}
export async function updateRight(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = rightUpdateSchema.safeParse(f);
  if (
    !parsed.success ||
    !uuid.safeParse(f.id).success ||
    !uuid.safeParse(f.contract).success
  )
    return invalid;
  const { error } = await client.rpc("update_contract_right", {
    target: f.id,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touchContract(f.contract);
  return { ok: true, message: "Sponsorrecht bijgewerkt." };
}
export async function registerFulfillment(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const parsed = fulfillmentSchema.safeParse(f);
  if (
    !parsed.success ||
    !uuid.safeParse(f.right).success ||
    !uuid.safeParse(f.contract).success
  )
    return {
      ok: false,
      message: parsed.success
        ? invalid.message
        : parsed.error.issues[0]?.message || invalid.message,
    };
  const { error } = await client.rpc("register_fulfillment", {
    target: f.right,
    details: parsed.data,
  });
  if (error) return failure(error.code);
  touchContract(f.contract);
  return { ok: true, message: "Uitvoering geregistreerd." };
}
export async function reviewFulfillment(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({
      id: uuid,
      contract: uuid,
      action: z.enum(["verify", "share", "unshare", "void"]),
      reason: z.string().trim().max(2000).optional(),
    })
    .safeParse(fields(form));
  if (!p.success || (p.data.action === "void" && !p.data.reason))
    return { ok: false, message: "Vul een reden in." };
  const { error } = await client.rpc("review_fulfillment", {
    target: p.data.id,
    action: p.data.action,
    reason: p.data.reason || "",
  });
  if (error) return failure(error.code);
  touchContract(p.data.contract);
  return {
    ok: true,
    message: {
      verify: "Uitvoering gecontroleerd.",
      share: "Uitvoering gedeeld met de sponsor.",
      unshare: "Uitvoering niet langer gedeeld.",
      void: "Registratie ongedaan gemaakt; de historie blijft bewaard.",
    }[p.data.action],
  };
}

// Documenten ---------------------------------------------------------------------
export async function uploadDocument(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const f = fields(form);
  const meta = z
    .object({
      company: uuid,
      contract: uuid,
      fulfillment: z.union([uuid, z.literal("")]).optional(),
      title: z.string().trim().min(1).max(160),
      role: z.enum(["contract", "amendment", "annex", "other"]).optional(),
      sponsor_shared: z.string().optional(),
      board_shared: z.string().optional(),
    })
    .safeParse(f);
  const file = form.get("file");
  if (!meta.success || !(file instanceof File))
    return { ok: false, message: "Vul een titel in en kies een bestand." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload(bytes, file.type);
  if (!check.ok) return { ok: false, message: check.message };
  const m = meta.data;
  const { data: id, error } = await client.rpc("register_document", {
    company: m.company,
    details: {
      title: m.title,
      mime_type: check.type,
      size_bytes: bytes.length,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      sponsor_shared: m.sponsor_shared === "on",
      board_shared: m.board_shared === "on",
    },
    link: m.fulfillment
      ? { fulfillment_id: m.fulfillment }
      : { contract_id: m.contract, role: m.role || "contract" },
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
        "Bestand niet opgeslagen. Het documentrecord blijft in afwachting en is voor niemand buiten de commissie zichtbaar.",
    };
  const done = await client.rpc("finalize_document", { target: id });
  if (done.error)
    return {
      ok: false,
      message:
        "Bestand geüpload maar niet vrijgegeven; controle mislukt. Probeer opnieuw te uploaden.",
    };
  touchContract(m.contract);
  return {
    ok: true,
    message:
      m.sponsor_shared === "on"
        ? "Document opgeslagen en gecontroleerd; gedeeld met de sponsor."
        : "Document privé opgeslagen en gecontroleerd.",
  };
}
export async function shareDocument(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({ id: uuid, contract: uuid, share: z.enum(["yes", "no"]) })
    .safeParse(fields(form));
  if (!p.success) return invalid;
  const { error } = await client
    .from("documents")
    .update({ sponsor_shared: p.data.share === "yes" })
    .eq("id", p.data.id)
    .select("id")
    .single();
  if (error) return failure(error.code);
  touchContract(p.data.contract);
  return {
    ok: true,
    message:
      p.data.share === "yes"
        ? "Document gedeeld met de sponsor."
        : "Delen ingetrokken. Nieuwe downloadlinks worden direct geweigerd.",
  };
}
