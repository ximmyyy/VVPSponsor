import type { ReactNode } from "react";
import { requireLocalDesignPreview } from "@/lib/design-preview-server";
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireLocalDesignPreview();
  return children;
}
