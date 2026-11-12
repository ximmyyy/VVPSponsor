import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
const file = readFileSync(".env.local", "utf8");
if (!/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321\s*$/m.test(file))
  throw new Error("Alleen de lokale standaardstack wordt ondersteund.");
if (/^SUPABASE_SECRET_KEY=/m.test(file))
  throw new Error("Bestaande binding wordt niet overschreven.");
const result = JSON.parse(
  execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
if (result.API_URL !== "http://127.0.0.1:54321" || !result.SECRET_KEY)
  throw new Error("Lokale stack niet beschikbaar.");
appendFileSync(".env.local", `\nSUPABASE_SECRET_KEY=${result.SECRET_KEY}\n`, {
  mode: 0o600,
});
console.log("Lokale serverbinding toegevoegd, geen sleutelwaarden getoond.");
