import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { z } from "zod";
const schema = z.object({
  role: z.enum(["super_admin", "sponsorcommissie", "clubbestuur", "sponsor"]),
  sponsor_id: z.uuid().nullable(),
});
export async function requireAccess() {
  const client = await createSessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/inloggen");
  const { data, error: dbError } = await client.rpc("get_access_context");
  const context = schema.safeParse(data);
  if (
    dbError ||
    !context.success ||
    (context.data.role === "sponsor" && !context.data.sponsor_id)
  )
    redirect("/geen-toegang");
  return { client, user, access: context.data };
}
