"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAccess } from "./context";
import { createSessionClient } from "@/lib/supabase/server";
export type EnrollState = { message: string; factorId: string; secret: string };
export async function enroll(_: EnrollState): Promise<EnrollState> {
  void _;
  await requireAccess();
  const client = await createSessionClient(true);
  const existing = await client.auth.mfa.listFactors();
  if (existing.error || existing.data.totp.some((f) => f.status === "verified"))
    return {
      message:
        "Er is al een authenticator ingesteld, of de status kon niet worden bepaald.",
      factorId: "",
      secret: "",
    };
  const result = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "VV Pernis",
  });
  if (result.error)
    return {
      message:
        "Instellen niet gelukt. Controleer bestaande factoren of probeer later opnieuw.",
      factorId: "",
      secret: "",
    };
  return {
    message: "Voeg deze sleutel toe aan je authenticator en voer de code in.",
    factorId: result.data.id,
    secret: result.data.totp.secret,
  };
}
export async function confirmEnrollment(
  _: { message: string },
  form: FormData,
) {
  await requireAccess();
  const input = z
    .object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { message: "Controleer de code." };
  const client = await createSessionClient(true);
  const result = await client.auth.mfa.challengeAndVerify(input.data);
  if (result.error) return { message: "Code ongeldig of verlopen." };
  redirect("/account");
}
