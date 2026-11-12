import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/modules/auth/context";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { client } = await requireAccess();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse(null, { status: 404 });
  const { data, error } = await client
    .from("documents")
    .select("object_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return new NextResponse(null, { status: 404 });
  const result = await client.storage
    .from("private-documents")
    .createSignedUrl(data.object_path, 60);
  if (result.error || !result.data)
    return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(result.data.signedUrl, {
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
