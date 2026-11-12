import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "./database.types";
export async function createSessionClient(writable = false) {
  getServerEnv();
  const env = getPublicEnv();
  const store = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        sameSite: "lax",
        secure: new URL(env.NEXT_PUBLIC_APP_URL).protocol === "https:",
      },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          if (writable)
            for (const { name, value, options } of values)
              store.set(name, value, options);
          // Server Components lezen; de proxy schrijft refreshcookies en cacheheaders.
        },
      },
    },
  );
}
export const createReadOnlyClient = () => createSessionClient();
