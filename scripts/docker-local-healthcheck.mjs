import { spawnSync } from "node:child_process";
import { localHealthcheckArgs } from "./local-healthcheck.mjs";

if (!process.env.VVP_DOCKER_BINARY) throw new Error("Ontbrekende Docker-executable.");
const result = spawnSync(process.env.VVP_DOCKER_BINARY, localHealthcheckArgs(process.argv.slice(2)), { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
