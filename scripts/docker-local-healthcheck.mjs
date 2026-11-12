import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { localHealthcheckArgs } from "./local-healthcheck.mjs";

if (!process.env.VVP_DOCKER_BINARY)
  throw new Error("Ontbrekende Docker-executable.");
const args = localHealthcheckArgs(process.argv.slice(2));
const index = args.indexOf("--name");
if (
  args[0] === "create" &&
  index >= 0 &&
  args[index + 1].startsWith("supabase_auth_")
) {
  let configured = "";
  try {
    const config = JSON.parse(
      readFileSync(
        join(
          process.env.DOCKER_CONFIG || join(homedir(), ".docker"),
          "config.json",
        ),
        "utf8",
      ),
    );
    configured = config.proxies?.default?.noProxy || "";
  } catch {}
  const project = args[index + 1].slice("supabase_auth_".length);
  const local = [
    configured,
    process.env.NO_PROXY || "",
    process.env.no_proxy || "",
    `supabase_kong_${project}`,
    `supabase_kong_${project}`.toLowerCase(),
  ]
    .filter(Boolean)
    .join(",");
  args.splice(1, 0, "--env", `NO_PROXY=${local}`, "--env", `no_proxy=${local}`);
}
const result = spawnSync(process.env.VVP_DOCKER_BINARY, args, {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
