import { execFileSync } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";

const output = execFileSync("./node_modules/.bin/supabase", ["gen", "types", "typescript", "--schema", "public"], { encoding: "utf8", env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" } });
const destination = "src/lib/supabase/database.types.ts";
const formatted = output.split("\n").map((line) => line.trimEnd()).join("\n").trimStart();
writeFileSync(`${destination}.tmp`, formatted);
renameSync(`${destination}.tmp`, destination);
