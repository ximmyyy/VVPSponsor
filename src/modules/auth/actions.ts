"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
export type AuthState = { message: string };
export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const input = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { message: "Vul een geldig e-mailadres en wachtwoord in." };
  const client = await createSessionClient(true);
  const { data, error } = await client.auth.signInWithPassword(input.data);
  if (error)
    return {
      message:
        "Inloggen niet gelukt. Controleer je gegevens of probeer het later opnieuw.",
    };
  if (data.user?.factors?.some((f) => f.status === "verified"))
    redirect("/mfa");
  redirect("/account");
}
export async function logout() {
  const client = await createSessionClient(true);
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Uitloggen is niet gelukt. Probeer opnieuw.");
  redirect("/inloggen");
}
export async function recover(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { message: "Vul een geldig e-mailadres in." };
  const client = await createSessionClient(true);
  const { error } = await client.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/bevestigen`,
  });
  if (error)
    return {
      message: "Aanvraag kon niet worden verwerkt. Probeer het later opnieuw.",
    };
  return {
    message:
      "Als dit adres een account heeft, ontvang je een herstelmail. Controleer je inbox.",
  };
}
export async function setPassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const password = z.string().min(12).max(128).safeParse(form.get("password"));
  if (!password.success || password.data !== form.get("confirmation"))
    return {
      message: "Gebruik minimaal 12 tekens en twee gelijke wachtwoorden.",
    };
  const client = await createSessionClient(true);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      message: "De link is ongeldig of verlopen. Vraag een nieuwe aan.",
    };
  const { error } = await client.auth.updateUser({ password: password.data });
  if (error)
    return {
      message:
        "Wachtwoord wijzigen is niet gelukt. Vraag zo nodig een nieuwe link aan.",
    };
  redirect("/account");
}
export async function verifyMfa(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const code = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(form.get("code"));
  if (!code.success) return { message: "Vul de zescijferige code in." };
  const client = await createSessionClient(true);
  const factors = await client.auth.mfa.listFactors();
  const factor = factors.data?.totp.find((f) => f.status === "verified");
  if (!factor) return { message: "Geen geverifieerde factor beschikbaar." };
  const result = await client.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.data,
  });
  if (result.error) return { message: "Code ongeldig of verlopen." };
  redirect("/account");
}
