import type { ReactNode } from "react";
import { requireLocalDesignPreview } from "@/lib/design-preview-server";
export default async function ManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireLocalDesignPreview();
  return children;
}
