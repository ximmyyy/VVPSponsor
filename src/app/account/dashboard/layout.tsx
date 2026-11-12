import type { ReactNode } from "react";
import { requireReporting } from "@/modules/reporting/access";
import { CrmShell } from "@/modules/crm/shell";
export default async function Layout({ children }: { children: ReactNode }) {
  const { access } = await requireReporting();
  return (
    <CrmShell
      current="/account/dashboard"
      boardOnly={access.role === "clubbestuur"}
    >
      {children}
    </CrmShell>
  );
}
