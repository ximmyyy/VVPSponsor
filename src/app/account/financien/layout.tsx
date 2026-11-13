import type { ReactNode } from "react";
import { requireCrm } from "@/modules/crm/access";
import { CrmShell } from "@/modules/crm/shell";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireCrm();
  return <CrmShell current="/account/financien">{children}</CrmShell>;
}
