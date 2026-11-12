"use server";
import { z } from "zod";
import { requireAccess } from "./context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";
import type { AuthState } from "./actions";
export async function invite(_: AuthState, form: FormData): Promise<AuthState> {
  const { client, access } = await requireAccess();
  if (access.role !== "super_admin") return { message: "Geen toegang." };
  const parsed = z
    .object({
      email: z.email().max(254),
      role: z.enum([
        "super_admin",
        "sponsorcommissie",
        "clubbestuur",
        "sponsor",
      ]),
      company: z.union([z.uuid(), z.literal("")]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Controleer de invoer." };
  const { email, role, company } = parsed.data;
  if ((role === "sponsor") !== Boolean(company))
    return {
      message:
        "Een sponsor vereist een bedrijf; andere rollen hebben geen bedrijfskoppeling.",
    };
  if (company) {
    const found = await client
      .from("sponsors")
      .select("id")
      .eq("id", company)
      .maybeSingle();
    if (found.error || !found.data)
      return { message: "Bedrijf niet gevonden." };
  }
  if (!process.env.SUPABASE_SECRET_KEY)
    return { message: "Uitnodigingen zijn nog niet geconfigureerd." };
  const { data, error } =
    await createAdminClient().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/bevestigen`,
    });
  if (error || !data.user)
    return { message: "Uitnodiging kon niet worden aangemaakt." };
  const grant = await client.rpc("set_user_access", {
    target: data.user.id,
    new_role: role,
    active: true,
    company: company || undefined,
  });
  if (grant.error)
    return {
      message:
        "Uitnodiging aangemaakt, maar toegang niet geactiveerd. De gebruiker heeft geen applicatierechten; controleer de toekenning.",
    };
  return {
    message:
      "Supabase heeft de uitnodiging geaccepteerd en de toegang is geactiveerd. Controleer de mailaflevering apart.",
  };
}
