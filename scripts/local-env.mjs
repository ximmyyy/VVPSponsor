import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const result = spawnSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
  encoding: "utf8", env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
});
if (result.status !== 0) throw new Error("Lokale Supabase-status ontbreekt. Start eerst npm run db:start.");
const status = JSON.parse(result.stdout);
if (status.API_URL !== "http://127.0.0.1:54321" || !status.PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
  throw new Error("Onverwacht lokaal doel of ontbrekende publishable key; geen configuratie geschreven.");
}
// Status bevat ook secrets: nooit loggen. Alleen publieke lokale waarden opslaan.
writeFileSync(".env.local", [
  "APP_ENV=local",
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
  "",
].join("\n"), { flag: "wx", mode: 0o600 });
console.log(".env.local aangemaakt; bestaande bestanden worden nooit overschreven.");
