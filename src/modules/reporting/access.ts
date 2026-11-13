import "server-only";
import { notFound } from "next/navigation";
import { requireAccess } from "@/modules/auth/context";
/** Dashboard en exports: Super Admin, commissie en (alle cijfers) bestuur. */
export async function requireReporting() {
  const context = await requireAccess();
  if (
    !["super_admin", "sponsorcommissie", "clubbestuur"].includes(
      context.access.role,
    )
  )
    notFound();
  return context;
}
