import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isLocalDesignPreview } from "./design-preview";

export async function localDesignPreviewEnabled() {
  const requestHeaders = await headers();
  return isLocalDesignPreview(process.env, requestHeaders.get("host"));
}
export async function requireLocalDesignPreview() {
  if (!(await localDesignPreviewEnabled())) notFound();
}
