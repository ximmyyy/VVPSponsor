import { spawnSync } from "node:child_process";

const result = spawnSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
  encoding: "utf8", env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
});
if (result.status !== 0) {
  console.error("Lokale stack niet beschikbaar; voer npm run db:start uit.");
  process.exit(result.status ?? 1);
}
const status = JSON.parse(result.stdout);
console.log(JSON.stringify({ api: status.API_URL, mail: status.MAILPIT_URL,
  publishableKeyAanwezig: Boolean(status.PUBLISHABLE_KEY) }, null, 2));
