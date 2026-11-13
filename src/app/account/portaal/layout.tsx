import type { ReactNode } from "react";
import { requirePortal } from "@/modules/portal/access";
import { PortalShell } from "@/modules/portal/shell";
import { contactHref } from "@/modules/portal/schema";

export default async function Layout({ children }: { children: ReactNode }) {
  const { client, sponsorId } = await requirePortal();
  const [company, settings] = await Promise.all([
    client.from("sponsors").select("name").eq("id", sponsorId).single(),
    client.from("club_settings").select("contact_email").maybeSingle(),
  ]);
  if (company.error) throw new Error("Bedrijf kon niet geladen worden.");
  return (
    <PortalShell
      company={company.data.name}
      contact={contactHref(settings.data?.contact_email, company.data.name)}
    >
      {children}
    </PortalShell>
  );
}
