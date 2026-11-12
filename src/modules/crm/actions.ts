"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCrm } from "./access";
import { companySchema, contactSchema } from "./schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";
// PostgreSQL accepteert null voor target/contact; de gegenereerde RPC-types modelleren dat niet.
export type Result = { ok: boolean; message: string };
const failed: Result = {
  ok: false,
  message: "Opslaan niet gelukt. Controleer de invoer en probeer opnieuw.",
};
function errorMessage(code?: string) {
  return code === "23505"
    ? "Er bestaat al een bedrijf met deze naam of dit KvK-nummer. Zoek eerst het bestaande bedrijf."
    : code === "23514"
      ? "Controleer de ingevoerde gegevens."
      : failed.message;
}
export async function saveCompany(
  id: string | null,
  input: unknown,
): Promise<Result> {
  const { client } = await requireCrm();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Controleer de gemarkeerde velden." };
  if (id && !z.uuid().safeParse(id).success) return failed;
  const { data, error } = await client.rpc("save_sponsor", {
    target: id!,
    details: parsed.data,
  });
  if (error || !data) return { ok: false, message: errorMessage(error?.code) };
  revalidatePath("/account/sponsors");
  redirect(`/account/sponsors/${data}`);
}
export async function saveContact(
  company: string,
  id: string | null,
  input: unknown,
): Promise<Result> {
  const { client } = await requireCrm();
  const parsed = contactSchema.safeParse(input);
  if (
    !z.uuid().safeParse(company).success ||
    (id && !z.uuid().safeParse(id).success) ||
    !parsed.success
  )
    return failed;
  const result = await client.rpc("save_sponsor_contact", {
    target: id!,
    company,
    details: parsed.data,
  });
  if (result.error) return failed;
  revalidatePath(`/account/sponsors/${company}`);
  return {
    ok: true,
    message:
      "Contactpersoon opgeslagen. Er is geen gebruikersaccount aangemaakt.",
  };
}
export async function archiveCompany(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const id = z.uuid().safeParse(form.get("id"));
  const archive = form.get("archive");
  if (!id.success || !["yes", "no"].includes(String(archive))) return failed;
  const result = await client
    .from("sponsors")
    .update({
      archived_at: archive === "yes" ? new Date().toISOString() : null,
    })
    .eq("id", id.data)
    .select("id")
    .single();
  if (result.error) return failed;
  revalidatePath("/account/sponsors");
  return {
    ok: true,
    message:
      archive === "yes"
        ? "Bedrijf gearchiveerd. Historie en bestaande machtigingen blijven behouden."
        : "Bedrijf hersteld.",
  };
}
export async function archiveContact(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const input = z
    .object({ id: z.uuid(), company: z.uuid(), archive: z.enum(["yes", "no"]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return failed;
  const { id, company, archive } = input.data;
  const result = await client
    .from("sponsor_contacts")
    .update({
      archived_at: archive === "yes" ? new Date().toISOString() : null,
      is_primary: false,
    })
    .eq("id", id)
    .eq("sponsor_id", company)
    .select("id")
    .single();
  if (result.error) return failed;
  revalidatePath(`/account/sponsors/${company}`);
  return {
    ok: true,
    message:
      archive === "yes"
        ? "Contactpersoon gearchiveerd."
        : "Contactpersoon hersteld.",
  };
}
export async function inviteContact(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const parsed = z
    .object({ company: z.uuid(), contact: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return failed;
  const { company, contact } = parsed.data;
  const [c, s] = await Promise.all([
    client
      .from("sponsor_contacts")
      .select("email")
      .eq("id", contact)
      .eq("sponsor_id", company)
      .is("archived_at", null)
      .single(),
    client
      .from("sponsors")
      .select("id")
      .eq("id", company)
      .is("archived_at", null)
      .single(),
  ]);
  if (c.error || s.error || !c.data.email)
    return {
      ok: false,
      message:
        "Een actief contact met e-mailadres en een niet-gearchiveerd bedrijf zijn vereist.",
    };
  if (!process.env.SUPABASE_SECRET_KEY)
    return {
      ok: false,
      message: "Uitnodigingen zijn nog niet geconfigureerd.",
    };
  const result = await createAdminClient().auth.admin.inviteUserByEmail(
    c.data.email,
    { redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/bevestigen` },
  );
  if (result.error || !result.data.user)
    return {
      ok: false,
      message:
        "Uitnodigen niet gelukt. Mogelijk bestaat dit account al; er is geen bestaande koppeling gewijzigd.",
    };
  const grant = await client.rpc("manage_sponsor_member", {
    company,
    target: result.data.user.id,
    contact,
    active: true,
  });
  if (grant.error)
    return {
      ok: false,
      message:
        "Uitnodiging aangemaakt, maar machtiging niet geactiveerd. Laat een Super Admin de toekenning controleren.",
    };
  revalidatePath(`/account/sponsors/${company}`);
  return {
    ok: true,
    message:
      "Sponsoruitnodiging door Supabase geaccepteerd. Controleer de mailaflevering apart.",
  };
}
export async function revokeMember(_: Result, form: FormData): Promise<Result> {
  const { client } = await requireCrm();
  const data = z
    .object({ company: z.uuid(), target: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return failed;
  const result = await client.rpc("manage_sponsor_member", {
    ...data.data,
    active: false,
    contact: null!,
  });
  if (result.error) return failed;
  revalidatePath(`/account/sponsors/${data.data.company}`);
  return {
    ok: true,
    message:
      "Bedrijfsmachtiging ingetrokken. Nieuwe gegevenstoegang is direct geblokkeerd.",
  };
}
