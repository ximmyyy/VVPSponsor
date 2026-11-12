import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCrm } from "./access";
import { blankCompany, type CompanyInput } from "./schema";
export async function companyDetails(id: string) {
  const context = await requireCrm();
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await context.client
    .from("sponsors")
    .select("id,name,trading_name,website,city,archived_at,sponsor_internal(*)")
    .eq("id", id)
    .maybeSingle();
  if (result.error)
    throw new Error("Bedrijfsgegevens konden niet geladen worden.");
  if (!result.data) notFound();
  const company = result.data;
  const internal = company.sponsor_internal;
  const values = {
    ...blankCompany,
    ...Object.fromEntries(
      Object.keys(blankCompany).map((key) => [
        key,
        (company as Record<string, unknown>)[key] ??
          (internal as Record<string, unknown> | null)?.[key] ??
          blankCompany[key as keyof CompanyInput],
      ]),
    ),
  } as CompanyInput;
  return { ...context, company, values };
}
