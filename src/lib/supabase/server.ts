import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import type { Database } from "./database.types";

// Alleen lezen in Server Components. Sessie-refresh en schrijvende adapters volgen in fase 3.
export async function createReadOnlyClient() {
  getServerEnv();
  const env = getPublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {
      throw new Error("Sessie schrijven vereist de auth-adapter uit fase 3.");
    } },
  });
}
