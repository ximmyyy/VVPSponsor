"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePortal } from "./access";
import { profileFields, profileRequestSchema, inviteSchema } from "./schema";
import { requireCrm } from "@/modules/crm/access";
import { requireAccess } from "@/modules/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";

export type Result = { ok: boolean; message: string };
const fields = (form: FormData) =>
  Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
const messages: Record<string, string> = {
  "23514":
    "Controleer de gegevens: er is niets gewijzigd, een waarde is ongeldig of er staan al vijf verzoeken open.",
  "23505":
    "Deze gegevens horen al bij een ander bedrijf; de commissie neemt contact op.",
  "42501": "Deze handeling is niet toegestaan.",
  P0002: "Het verzoek of de gebruiker is niet (meer) beschikbaar.",
};
const failure = (code?: string): Result => ({
  ok: false,
  message:
    (code && messages[code]) ||
    "Niet gelukt. Er is niets gewijzigd; probeer het opnieuw.",
});

export async function submitProfileRequest(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requirePortal();
  const parsed = profileRequestSchema.safeParse(fields(form));
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Controleer de invoer.",
    };
  const { message, ...rest } = parsed.data;
  const details = Object.fromEntries(profileFields.map(([k]) => [k, rest[k]]));
  const { error } = await client.rpc("submit_profile_request", {
    details,
    message,
  });
  if (error) return failure(error.code);
  revalidatePath("/account/portaal/bedrijf");
  return {
    ok: true,
    message:
      "Wijzigingsverzoek verstuurd. De commissie beoordeelt het; je ziet de status hieronder.",
  };
}
export async function withdrawRequest(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requirePortal();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return failure();
  const { error } = await client.rpc("withdraw_request", { target: id.data });
  if (error) return failure(error.code);
  revalidatePath("/account/portaal/bedrijf");
  return { ok: true, message: "Verzoek ingetrokken." };
}
export async function inviteColleague(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requirePortal();
  const parsed = inviteSchema.safeParse(fields(form));
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Controleer het e-mailadres.",
    };
  if (!process.env.SUPABASE_SECRET_KEY)
    return {
      ok: false,
      message:
        "Uitnodigen is nog niet geconfigureerd. Neem contact op met de commissie.",
    };
  const email = parsed.data.email.toLowerCase();
  const invitation = await client.rpc("portal_create_invitation", {
    invitee: email,
  });
  if (invitation.error || !invitation.data)
    return failure(invitation.error?.code);
  // Alleen Auth gebruikt de server-only adminclient; de koppeling gebeurt met de eigen sessie.
  const invite = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/bevestigen`,
  });
  if (invite.error || !invite.data.user)
    return {
      ok: false,
      message:
        "Uitnodigen niet gelukt. Mogelijk heeft dit adres al een account; neem dan contact op met de commissie.",
    };
  const grant = await client.rpc("portal_accept_invitation", {
    invitation: invitation.data,
    target: invite.data.user.id,
  });
  if (grant.error)
    return {
      ok: false,
      message:
        "Uitnodiging verstuurd, maar toegang niet gekoppeld. Neem contact op met de commissie.",
    };
  revalidatePath("/account/portaal/collegas");
  return {
    ok: true,
    message: `Uitnodiging verstuurd naar ${email}. Je collega krijgt toegang tot dit bedrijf zodra het account is geactiveerd.`,
  };
}
export async function revokeColleague(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requirePortal();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return failure();
  const { error } = await client.rpc("portal_revoke_member", {
    target: id.data,
  });
  if (error) return failure(error.code);
  revalidatePath("/account/portaal/collegas");
  return {
    ok: true,
    message:
      "Toegang ingetrokken. Dit account kan het portaal niet meer gebruiken.",
  };
}

// Commissie: verzoeken beoordelen -------------------------------------------------------
export async function reviewRequest(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client } = await requireCrm();
  const p = z
    .object({
      id: z.uuid(),
      decision: z.enum(["approve", "reject"]),
      reply: z.string().trim().max(2000),
    })
    .safeParse({ reply: "", ...fields(form) });
  if (!p.success) return failure();
  if (p.data.decision === "reject" && !p.data.reply)
    return {
      ok: false,
      message: "Geef bij afwijzen een toelichting voor de sponsor.",
    };
  const { error } = await client.rpc("review_request", {
    target: p.data.id,
    approve: p.data.decision === "approve",
    reply: p.data.reply,
  });
  if (error)
    return error.code === "23505"
      ? {
          ok: false,
          message:
            "Niet verwerkt: naam of KvK-nummer hoort al bij een ander bedrijf. Wijs af met toelichting of pas het CRM aan.",
        }
      : failure(error.code);
  revalidatePath("/account/verzoeken");
  return {
    ok: true,
    message:
      p.data.decision === "approve"
        ? "Verzoek goedgekeurd en verwerkt in het CRM."
        : "Verzoek afgewezen.",
  };
}

// Super Admin: contactadres -----------------------------------------------------------
export async function saveClubContact(
  _: Result,
  form: FormData,
): Promise<Result> {
  const { client, access } = await requireAccess();
  if (access.role !== "super_admin") return failure("42501");
  const p = z
    .object({
      club_name: z.string().trim().min(1).max(120),
      contact_email: z.union([z.email().max(254), z.literal("")]),
    })
    .safeParse(fields(form));
  if (!p.success)
    return {
      ok: false,
      message: "Vul een clubnaam en een geldig e-mailadres in.",
    };
  const { error } = await client
    .from("club_settings")
    .update({
      club_name: p.data.club_name,
      contact_email: p.data.contact_email || null,
    })
    .eq("id", true)
    .select("id")
    .single();
  if (error) return failure(error.code);
  revalidatePath("/account/instellingen");
  return { ok: true, message: "Clubinstellingen opgeslagen." };
}
