import "server-only";
import { serverEnvSchema } from "./schema";

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({ APP_ENV: process.env.APP_ENV });
  if (!parsed.success) throw new Error("APP_ENV ontbreekt of is ongeldig.");
  return parsed.data;
}
