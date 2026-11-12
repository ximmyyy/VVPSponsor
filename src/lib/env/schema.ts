import { z } from "zod";

const httpUrl = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Gebruik HTTP of HTTPS.");

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_").min(20),
});

export const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]),
});
