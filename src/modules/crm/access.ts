import "server-only";
import { notFound } from "next/navigation";
import { requireAccess } from "@/modules/auth/context";
export async function requireCrm() {
  const context = await requireAccess();
  if (!["super_admin", "sponsorcommissie"].includes(context.access.role))
    notFound();
  return context;
}
