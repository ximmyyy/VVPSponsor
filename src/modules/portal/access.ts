import "server-only";
import { notFound } from "next/navigation";
import { requireAccess } from "@/modules/auth/context";
/** Portaal uitsluitend voor actieve sponsoraccounts met actieve bedrijfsmachtiging. */
export async function requirePortal() {
  const context = await requireAccess();
  if (context.access.role !== "sponsor" || !context.access.sponsor_id)
    notFound();
  return { ...context, sponsorId: context.access.sponsor_id };
}
